// serviceworker.js
// Serves Firebase Clients, Utilizes corescraper.
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var corescraper = require("./corescraper.js");
var signup = require("./signupflow.js");
var fb = require('firebase-admin');
var tokens = require('./tokens.js');
var serviceAccount = require("./../echelon-f16f8-firebase-adminsdk-ytuzc-7e23c999b7.json");
var mwc = require('./mwc.js');
var idgenerator = require('./idgenerator.js');

var WORKER_ID = "";

// Initialize
async function initializeApp() {
  // Generate Server ID
  WORKER_ID = idgenerator.randString(15);

  await fb.initializeApp({
    credential: fb.credential.cert(serviceAccount),
    databaseURL: "https://echelon-f16f8.firebaseio.com/"
  });
  await corescraper.initializeApp();
  //await signup.initializeApp(WORKER_ID, fb, corescraper);
  await mwc.initializeApp(WORKER_ID, fb);
}



async function test() {
  await initializeApp();
  mwc.joinWorkers();
  //let data = await corescraper.getUserSnapshot("STUDENT\\s1620641", "YellowRiver812");

  //await fb.database().ref('data').push(data);
}


test();
