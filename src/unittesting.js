// unittesting.js
// Testing For Scraper
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var corescraper = require("./corescraper.js");
var signup = require("./signupflow.js");
var fb = require('firebase-admin');
var tokens = require('./tokens.js');
var serviceAccount = require("./../echelon-f16f8-firebase-adminsdk-ytuzc-7e23c999b7.json");

// Initialize
async function initializeApp() {
  await fb.initializeApp({
    credential: fb.credential.cert(serviceAccount),
    databaseURL: "https://echelon-f16f8.firebaseio.com/"
  });
}

async function simulateUserSignup(FB_ID, PSC_ID, PSC_PASS) {
  await initializeApp();

  var signup_ref = await fb.database().ref('servercomm/signup');

  var signupObject = {
    FB_ID: FB_ID,
    PSC_ID: PSC_ID,
    PSC_PASS: PSC_PASS
  };

  var signup_user_ref = await signup_ref.child(FB_ID);

  await monitorRefActivity(signup_user_ref);
  await signup_user_ref.set(signupObject);
}



async function monitorRefActivity(REF) {
  REF.on('value', async function(snap){
    await console.log(snap.val());
  });
}

//simulateUserSignup('parentuser', tokens.SAMPLES.PARENTID, tokens.SAMPLES.PARENTPW);


let obj1 = {
  name: "John",
  date: "12-12-12",
  times: [12,12,12],
  son: {
    name: "JJ Junior",
    date: "12-01-01"
  },
  point: 1
}

let obj2 = {
  name: "John",
  date: "12-12-12",
  times: [12,12,12],
  son: {
    name: "VV Junior",
    date: "12-01-01"
  }
}


function updateObject(time, pathArr, updateType, value) {
  return {
    time: time,
    path: pathArr,
    updateType: updateType,
    value: value
  }
  /*
  Update Type Should Be .created, .changed, .deleted
  */
}

// Gets Differences on Current Level
function getUpdates(oldObject, newObject, appendPath) {

  var updates = [];

  // Check For Objects that have been deleted or changed by checking every directory of old in new
  for (var oldObjectKey in oldObject) {
    if (newObject[oldObjectKey] != oldObject[oldObjectKey]) {
        console.log('-------');
        console.log(newObject[oldObjectKey]);
        console.log(oldObject[oldObjectKey]);
      if (newObject[oldObjectKey] == undefined) {
        updates.push(updateObject("TIME", appendPath.push(oldObjectKey), "deleted", ""));
      }
    }
  }


}


getUpdates(obj1, obj2, []);
