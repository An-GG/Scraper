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

simulateUserSignup('parentuser', tokens.SAMPLES.PARENTID, tokens.SAMPLES.PARENTPW);
