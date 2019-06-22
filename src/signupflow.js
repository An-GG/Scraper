// signupflow.js
// Handle sign up for firebase clients
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var fb = null;
var scraper = null;

function initializeApp(firebase, corescraper) {
  fb = firebase;
  scraper = corescraper;
}

async function handleUserSignUp(PSC_ID, PSC_PASSWORD, FB_ID) {
  var returnObject = {
    USER_PREEXISTS : false,
    LOGIN_FAILED : false,
    INCORRECT_CREDENTIALS : false,
    SIGNUP_COMPLETE : false
  };

  // TODO: ACKNOWLEDGE CLIENT

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
  // TODO: UPDATE FIREBASE STATUS AND METADATA

  // GET USER UNDETAILED GRADES
  await scraper.openGradebook(sessionID);
  let undetailedGrades = await scraper.scrapeUndetailedGrades(sessionID);
  // TODO: UPDATE FIREBASE STATUS AND UNDETAILED GRADES

  // GET USER DETAILED GRADES
  let detailedGrades = await scraper.scrapeDetailedGrades(sessionID);
  scraper.endSession(sessionID);

  // TODO: CREATE INITIAL ENTRY

  // REGISTER HISD CLIENT AND FB USER
  await registerHisdClient(PSC_ID, PSC_PASSWORD, FB_ID);
  await registerFirebaseUser(PSC_ID, PSC_PASSWORD, FB_ID, metadata.studentName, metadata.studentID, metadata.school, metadata.gradeLevel, false);

  // TODO: UPDATE FB FINAL STATUS

  returnObject.SIGNUP_COMPLETE = true;
  return returnObject;

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
  let fbUserRef = fb.database().ref('users/' + FB_ID);
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
