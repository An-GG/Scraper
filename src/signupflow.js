// signupflow.js
// Handle sign up for firebase clients
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var fb = null;

function initializeApp(firebase) {
  fb = firebase;
}

async function registerUser() {

}

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
    // If The User Password Combo Prexist
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
    // If The User Password Combo Do Not Prexist
    await passwordPSCUserRef.set([FB_ID]);
    returnObject.userAddedSuccessfully = true;
  }
  return returnObject;
}

async function registerFirebaseUser(PSC_ID, PSC_PASSWORD, FB_ID, NAME, STUDENTID, SCHOOL, GRADE_LEVEL) {
  let idLowercase = PSC_ID.toLowerCase();
  let fbUserRef = fb.database().ref('users/' + FB_ID);
  var fbUser = (await fbUserRef.once('value')).val();

  var returnObject = {
    fbUserAddedSuccessfully : false,
    fbUserPrexisted : false
  }

  var userobject = {
    name : NAME,
    studentid : STUDENTID,
    school : SCHOOL,
    gradeLeve : GRADE_LEVEL,
    psc_id : PSC_ID,
    psc_password : PSC_PASSWORD
  }

  if (fbUser != null) {
    // Firebase User Preexists
    returnObject.fbUserPrexisted = true;
    // NOTE: Even if user preexists, the user info will just be updated.
  }

  await fbUserRef.set(userobject);
  returnObject.fbUserAddedSuccessfully = true;

  return returnObject;
}

// EXPORTS

module.exports = {
  initializeApp: initializeApp,
  registerHisdClient: registerHisdClient
};
