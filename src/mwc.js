// mwc.js
// Multi - Worker Collaboration
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var diff = require('./deepDifference.js');
var fb = null;
var WORKER_ID = ""
const SERVERCOMM_REF = 'servercomm';
const DATA_REF = 'data';

const MSEC_BETWEEN_CHECKIN = 10000; // 10 seconds
const MSEC_BETWEEN_TIMEOUT = 15000; // 15 seconds

var scrapeTime = 7;
var maxUpdateTime = 120;
var currentServerMode = "";

async function initializeApp(workerid, firebase) {
  WORKER_ID = workerid;
  fb = firebase;

  await trackWorkers();
  await checkIn();
  await synchronizeClients();

  let scrapeTimeRef = fb.database().ref(SERVERCOMM_REF + "/scrapetime");
  let maxUpdateTimeRef = fb.database().ref(SERVERCOMM_REF + "/maxupdatetime");
  scrapeTime = (await scrapeTimeRef.once('value')).val();
  maxUpdateTime = (await maxUpdateTimeRef.once('value')).val();

  scrapeTimeRef.on('value', function(snap) {
    scrapeTime = snap.val();
  });
  maxUpdateTimeRef.on('value', function(snap) {
    maxUpdateTime = snap.val();
  });
}

var workers = {};

// Tracks Other Workers To Ensure Check In
async function trackWorkers() {
  let workersRef = fb.database().ref(SERVERCOMM_REF + "/workers");
  workersRef.on('child_added', function(snap, key) {
    let worker = snap.val();
    workers[snap.key] = worker;
    checkWorkerTimeout(worker);
  });
  workersRef.on('child_removed', function(snap) {
    delete workers[snap.key];
  })
}

// Recursive Check In Function Checks In Every 5 Minutes
async function checkIn() {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + WORKER_ID);
  let timestamp = (new Date() * 1); // In milliseconds unix time
  workerRef.set({
    lastCheckIn: timestamp,
    workerID: WORKER_ID
  });
  setTimeout(checkIn, MSEC_BETWEEN_CHECKIN);
}

async function checkWorker(workerID) {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + workerID);
  workerRef.once('value').then(function(snap){
    let val = snap.val();
    checkWorkerTimeout(val);
  });
}

async function checkWorkerTimeout(worker) {
  let currentTime = (new Date() * 1);
  let timeDelta = currentTime - worker.lastCheckIn;
  if (timeDelta > MSEC_BETWEEN_TIMEOUT) {
    deleteWorker(worker.workerID);
  } else {
    // Schedule Another Check
    setTimeout(checkWorker, MSEC_BETWEEN_TIMEOUT, worker.workerID);
  }
}

async function deleteWorker(workerID) {
  let workerRef = fb.database().ref(SERVERCOMM_REF + "/workers/" + workerID);
  await workerRef.remove();
  // TODO: Remove worker from scraper pool
}

function getServerMode() {
  let numberOfWorkers = Object.keys(workers).length;
  if (numberOfWorkers < 3) {
    scrapers = workers;
    console.log('CURRENT MODE SET TO DYNAMIC');
    return "DYNAMIC";
  }
  let numberOfClients = Object.keys(clients).length;

  let maxClientsPerScraper = maxUpdateTime / scrapeTime;
  let numberOfNeededWorkers = Math.ceil(numberOfClients / maxClientsPerScraper);

  scrapers = {};
  let sortedWorkerIDs = Object.keys(workers).sort(sortAlphaNum);
  var workerNumber = -1;
  for (var WORKER_N = 0; WORKER_N < sortedWorkerIDs.length; WORKER_N++) {
    if (sortedWorkerIDs[WORKER_N] == WORKER_ID) {
      workerNumber = WORKER_N;
    }
    if (numberOfNeededWorkers >= (WORKER_N + 1)) {
      scrapers[sortedWorkerIDs[WORKER_N]] = workers[sortedWorkerIDs[WORKER_N]];
    }
  }




  if (numberOfNeededWorkers >= (workerNumber + 1)) {
    console.log('CURRENT MODE SET TO SCRAPER');
    return "SCRAPER";
  } else {
    console.log('CURRENT MODE SET TO SIGNON');
    return "SIGNON";
  }
}




 // Scraper

 var clients = {};
 var scrapers = {};
 var assignedClients = {};
 var trackedClients = {};

async function synchronizeClients() {
  let clientsRef = fb.database().ref('hisd_clients');

  await clientsRef.on('child_added', async function (snap, prevKey) {
    let val = snap.val();
    clients[snap.key] = val;
    console.log(clients);
    taskRefactor();
  });

  await clientsRef.on('child_removed', async function (snap) {
    delete clients[snap.key];
    taskRefactor();
  });
  // TODO:  Check for collisions between child removed and changed, also add boundaries for needed checks only
  await clientsRef.on('child_changed', async function (snap, prevKey) {
    let val = snap.val();
    clients[snap.key] = val;
  });
}

function taskRefactor() {
  getServerMode(); // Call To Get Scrapers
  let scraperWorkersIDs = Object.keys(scrapers);

  // Get Number Of Scrapers
  let numberOfScrapers = scraperWorkersIDs.length;

  // Get Worker's Place In List
  let sorted = scraperWorkersIDs.sort(sortAlphaNum);
  var scraperNumber = -1;
  for (var SCRAPER_N = 0; SCRAPER_N < sorted.length; SCRAPER_N++) {
    if (sorted[SCRAPER_N] == WORKER_ID) {
      scraperNumber = SCRAPER_N;
    }
  }

  // Get Sorted Clients List
  let sortedClientsList = (Object.keys(clients)).sort(sortAlphaNum);
  let numberOfClients = sortedClientsList.length;

  // Number Of Clients Per Woker
  let numberOfClientsPerWorker = Math.ceil(numberOfClients/numberOfScrapers);

  // Cycle Through Clients To Get Assigned Clients
  let startingIndex = scraperNumber * numberOfClientsPerWorker;
  assignedClients = {};
  for (var i = 0; i < numberOfClientsPerWorker; i++) {
    let clientID = sortedClientsList[i + startingIndex];
    if (clientID != null) {
      let client = clients[clientID];
      assignedClients[clientID] = client;
    }
  }

  // TODO: Add off function to remove child added callback for clients which are no longer in assignedClients or in trackedClients
  return assignedClients;
  console.log(assignedClients);
}

async function getTrackingForID(psc_id, fb_id) {
  let trackedClientsIDs = Object.keys(trackedClients);
  let clientKey = fb_id + "|" + psc_id;
  if (trackedClientsIDs.includes(clientKey)) {
    return trackedClients[clientKey];
  } else {
    let dataRef = fb.database().ref(DATA_REF + '/' + fb_id + '/' + psc_id);
    let trackingRef = dataRef.child('tracking');
    let originRef = dataRef.child('origin');
    let origin = (await originRef.once('value')).val();
    let updates = (await trackingRef.once('value')).val();
    trackedClients[clientKey] = {
      tracking: {}
    };
    trackedClients[clientKey]['origin'] = origin;
    trackedClients[clientKey]['onCallback'] = trackingRef.on('child_added', async function (snap, prevKey) {
      let update = snap.val();
      trackedClients[clientKey]['tracking'][snap.key] = update;
    });
    if (updates == null) {
      trackedClients[clientKey]['tracking'] = {};
      return {
        origin: origin,
        tracking: {}
      };
    } else {
      return {
        origin: origin,
        tracking: updates
      };
    }
  }
}

async function getRebuiltSnapshot(psc_id, fb_id) {
  let updates = await getTrackingForID(psc_id, fb_id);
  let sortedTrackingIDs = Object.keys(updates.tracking).sort(sortAlphaNum);
  var current = JSON.parse(JSON.stringify(updates.origin));
  for (let trackingID of sortedTrackingIDs) {
    let update = updates['tracking'][trackingID];
    current = diff.rebuild(current, update);
  }
  return current;
}



// Assistants

var reA = /[^a-zA-Z]/g;
var reN = /[^0-9]/g;

function sortAlphaNum(a, b) {
  var aA = a.replace(reA, "");
  var bA = b.replace(reA, "");
  if (aA === bA) {
    var aN = parseInt(a.replace(reN, ""), 10);
    var bN = parseInt(b.replace(reN, ""), 10);
    return aN === bN ? 0 : aN > bN ? 1 : -1;
  } else {
    return aA > bA ? 1 : -1;
  }
}




// EXPORTS
module.exports = {
  initializeApp: initializeApp,
  trackWorkers: trackWorkers,
  checkIn: checkIn,
  synchronizeClients: synchronizeClients,
  taskRefactor: taskRefactor,
  getRebuiltSnapshot: getRebuiltSnapshot,
  getServerMode: getServerMode
};
