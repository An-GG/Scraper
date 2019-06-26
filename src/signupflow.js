// signupflow.js
// Handle sign up for firebase clients
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var fb = null;
var scraper = null;
var WORKER_ID = ""
const SIGNUP_REF = 'servercomm/signup';
const DATA_REF = 'data';


async function initializeApp(workerid, firebase, corescraper) {
  WORKER_ID = workerid;
  fb = firebase;
  scraper = corescraper;
  await attatchSignupListener();
}


// QUEING SYSTEM
// Queue is list of tasks to be processed.
// If Processor is busy, task is added to queue.
// If Processor is not busy, task is sent directly to processor.

var taskN = 0;
var queue = {};

// Sample Task to be in queue:
/*
'N' : {
  REF: REF,
  FB_ID: ID,
  PSC_PASS: PASS,
  PSC_ID: PSCID
}
*/

async function addSignupRequest(PSC_ID, PSC_PASSWORD, FB_ID, USER_SIGNUP_REF) {
  // Check Current Status
  let currentStatus = await getSignupStatus(USER_SIGNUP_REF);
  if (currentStatus == null) {
    await setSignupStatus(USER_SIGNUP_REF, "ACKNOWLEDGED");
  } else if (currentStatus == "ACKNOWLEDGED") {

  } else {
    // If Progressed Past ACKNOWLEDGED Then Drop Request
    return;
  }


  let queueIsEmpty = (Object.keys(queue).length == 0);
  // Add Request To Queue
  taskN+=1;
  queue[taskN.toString()] = {
    REF: USER_SIGNUP_REF,
    FB_ID: FB_ID,
    PSC_ID: PSC_ID,
    PSC_PASSWORD: PSC_PASSWORD
  };
  // Check If Processor Is Busy By Checking If Queue Is Empty
  if (queueIsEmpty) {
    // Send To Processor
    processRequest(taskN.toString());
  } else {
    // Processor is working, will get to task eventually.
  }
}

// Processor
async function processRequest(taskID) {
  let requestObject = queue[taskID];

  // Check Status Before Handling
  let currentStatus = await getSignupStatus(requestObject.REF);
  if (currentStatus == null || currentStatus == "ACKNOWLEDGED") {
    await setSignupStatus(requestObject.REF, "STARTED");
  } else {
    // If Progressed Past ACKNOWLEDGED Then Drop Request
    return;
  }


  await handleUserSignUp(requestObject.PSC_ID, requestObject.PSC_PASSWORD, requestObject.FB_ID, requestObject.REF);

  // After Handling
  delete queue[taskID];
  if (Object.keys(queue).length != 0) {
    // The Queue Is Not Empty
    let taskID = Object.keys(queue)[0];
    await processRequest(taskID);
  }
}




// Assistant Methods

async function attatchSignupListener() {
  var signup_ref = await fb.database().ref(SIGNUP_REF);
  await signup_ref.on('child_added', async function(snap, key) {
    var val = await snap.val();
    var user_signup_ref = await signup_ref.child(val.FB_ID);
    addSignupRequest(val.PSC_ID.toLowerCase(), val.PSC_PASS, val.FB_ID, user_signup_ref);
  });
}

async function handleUserSignUp(PSC_ID, PSC_PASSWORD, FB_ID, USER_SIGNUP_REF) {

  var WORKER_USER_SIGNUP_REF = await USER_SIGNUP_REF.child(WORKER_ID);

  var returnObject = {
    USER_PREEXISTS : false,
    LOGIN_FAILED : false,
    INCORRECT_CREDENTIALS : false,
    SIGNUP_COMPLETE : false
  };


  // CHECK FOR EXISTING USER
  let existingUserMatch = await checkExistingUserEntry(PSC_ID, PSC_PASSWORD, FB_ID);
  if (existingUserMatch.fbUserPSCIDMatch) {
    // TODO: HANDLE EDGE CASE WHERE USER PREEXISTS (BETTER)
    returnObject.USER_PREEXISTS = true;
    return returnObject;
  }

  // ATTEMPT SIGN IN
  let sessionID = await scraper.createSession(PSC_ID, PSC_PASSWORD);
  await scraper.initializeSession(sessionID);
  let signInResult = await scraper.navigateAndAttemptLogin(sessionID);
  if (!signInResult.loginSuccess) {
    returnObject.LOGIN_FAILED = true;
    returnObject.INCORRECT_CREDENTIALS = signInResult.passwordIncorrect;
    return returnObject;
  }


  // SCRAPE USER METADATA
  let metadata = await scraper.scrapeStudentMetadata(sessionID);
  // UPDATE FIREBASE STATUS AND METADATA
  await (await WORKER_USER_SIGNUP_REF.child('meta')).set(metadata);
  await setSignupStatus(USER_SIGNUP_REF, 'AUTHSUCCESS');

  // GET USER UNDETAILED GRADES
  await scraper.openGradebook(sessionID);
  let undetailedGrades = JSON.parse(JSON.stringify(await scraper.scrapeUndetailedGrades(sessionID)));

  // UPDATE FIREBASE STATUS AND UNDETAILED GRADES
  await (await WORKER_USER_SIGNUP_REF.child('undetailed')).set(undetailedGrades);
  await setSignupStatus(USER_SIGNUP_REF, 'UNDETAILED_COMPLETE');

  // GET USER DETAILED GRADES
  let detailedGrades = await scraper.scrapeDetailedGrades(sessionID);
  scraper.endSession(sessionID);

  // CREATE INITIAL ENTRY
  var dataref = await fb.database().ref(DATA_REF + '/' + FB_ID + '/' + PSC_ID);
  let initialEntry = {
    lightweight_snapshot: undetailedGrades,
    full_snapshot: detailedGrades,
    tracking: {
      origin: detailedGrades
    }
  }
  await dataref.set(initialEntry);

  // REGISTER HISD CLIENT AND FB USER
  await registerHisdClient(PSC_ID, PSC_PASSWORD, FB_ID);
  await registerFirebaseUser(PSC_ID, PSC_PASSWORD, FB_ID, metadata.studentName, metadata.studentID, metadata.school, metadata.gradeLevel, false);

  // UPDATE FB FINAL STATUS
  await setSignupStatus(USER_SIGNUP_REF, 'SIGNUP_SUCCESS');

  returnObject.SIGNUP_COMPLETE = true;

  console.log('Done');
  return returnObject;
}

async function setSignupStatus(USER_SIGNUP_REF, STATUS) {
  var status_ref = await USER_SIGNUP_REF.child('status');
  await status_ref.set(STATUS);
}

async function getSignupStatus(USER_SIGNUP_REF) {
  var status_ref = await USER_SIGNUP_REF.child('status');
  await status_ref.once('value').then(async function(snap){
    var val = await snap.val();
    return val;
  });
}


async function checkExistingUserEntry(PSC_ID, PSC_PASSWORD, FB_ID) {
  let idLowercase = PSC_ID.toLowerCase();
  let fbUserRef = fb.database().ref('users/' + FB_ID);
  var fbUser = (await fbUserRef.once('value')).val();

  var returnObject = {
    fbUserPreexisted : false,
    fbUserPSCIDMatch : false,
    fbUserPSCPassMatch : false
  }

  if (fbUser != null) {
    returnObject.fbUserPreexisted = true;
    if (fbUser.psc_id == idLowercase) {
      returnObject.fbUserPSCIDMatch = true;
    }
    if (fbUser.psc_password == PSC_PASSWORD) {
      returnObject.fbUserPSCPassMatch = true;
    }
  }
  return returnObject;
}


//// The Register Functions Make Two Assumptions:
//// 1. The Login For PSC_ID and PSC_PASS works
//// 2. The User Doesnt Preexist

async function registerHisdClient(PSC_ID, PSC_PASSWORD, FB_ID) {
  let idLowercase = PSC_ID.toLowerCase();
  let passwordPSCUserRef = fb.database().ref('hisd_clients/' + idLowercase + "/" + PSC_PASSWORD);
  var fbUsersForPasswordArray = (await passwordPSCUserRef.once('value')).val();

  var returnObject = {
    userAddedSuccessfully : false,
    pscUserWithDiffFBIDPreexists : false,
    exactUserPreexists : false
  };

  if (fbUsersForPasswordArray != null) {
    // If The User Password Combo Preexist
    if (fbUsersForPasswordArray.includes(FB_ID)) {
      // User Already Registered With Same Account Info
      returnObject.exactUserAlreadyExists = true;
    } else {
      fbUsersForPasswordArray.push(FB_ID);
      await passwordPSCUserRef.set(fbUsersForPasswordArray);
      returnObject.userAddedSuccessfully = true;
      returnObject.pscUserWithDiffFBIDPreexists = true;
    }
  } else {
    // If The User Password Combo Do Not Preexist
    await passwordPSCUserRef.set([FB_ID]);
    returnObject.userAddedSuccessfully = true;
  }
  return returnObject;
}

async function registerFirebaseUser(PSC_ID, PSC_PASSWORD, FB_ID, NAME, STUDENTID, SCHOOL, GRADE_LEVEL, OVERWRITE_IF_PREEXISTS) {
  let idLowercase = PSC_ID.toLowerCase();
  let fbUserRef = fb.database().ref('users/' + FB_ID + '/' + PSC_ID);
  var fbUser = (await fbUserRef.once('value')).val();

  var returnObject = {
    fbUserAddedSuccessfully : false,
    fbUserPreexisted : false
  }

  var userobject = {
    name : NAME,
    studentid : STUDENTID,
    school : SCHOOL,
    gradeLevel : GRADE_LEVEL,
    psc_id : idLowercase,
    psc_password : PSC_PASSWORD
  }

  if (fbUser != null) {
    // Firebase User Preexists
    returnObject.fbUserPreexisted = true;

    if (OVERWRITE_IF_PREEXISTS) {
      await fbUserRef.set(userobject);
      returnObject.fbUserAddedSuccessfully = true;
    }
  } else {
    await fbUserRef.set(userobject);
    returnObject.fbUserAddedSuccessfully = true;
  }

  return returnObject;
}

// EXPORTS

module.exports = {
  initializeApp: initializeApp,
  registerHisdClient: registerHisdClient,
  registerFirebaseUser: registerFirebaseUser,
  handleUserSignUp: handleUserSignUp
};
