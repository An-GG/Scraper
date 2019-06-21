// main.js
// Lowest Level Scraping Function
// Copyright (c) Ankush Girotra 2019. All rights reserved.

const PSCONNECT_URL = "https://publicapps.houstonisd.org/ParentStudentConnect/Login.aspx";
const GRADEFRAME_URL = "https://parent.gradebook.houstonisd.org/pc/StudentMain.aspx";

const puppeteer = require('puppeteer');
const innertext = require('innertext');
const idgenerator = require('./idgenerator.js');

var sessions = {};
var browser = {};

async function initializeApp() {
  browser = await puppeteer.launch();
}


async function createSession(input_username, input_password) {
  let sessionID = input_username + input_password + idgenerator.randString(10);
  sessions[sessionID] = {
    input_username : input_username,
    input_password : input_password,
    sessionID : sessionID,
    pageContent : "",
    tabledata : {},
    nonEmptyCells : []
  }
  return sessionID;
}

async function initializeSession(sessionID) {
  var session = sessions[sessionID];
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  session.page = page;
}

async function navigateAndAttemptLogin(sessionID) {
  var session = sessions[sessionID];
  await session.page.goto(PSCONNECT_URL);

  // LOGIN USING GIVEN CREDENTIALS
  await session.page.type("#ctl00_ContentArea_txtUserName", session.input_username);
  await session.page.type("#ctl00_ContentArea_txtPassword", session.input_password);
  const passwordField = await session.page.$("#ctl00_ContentArea_txtPassword");
  await passwordField.press('Enter');

  // TODO: CREATE ERROR HANDLE FOR IF LOGIN FAILS
}

async function openGradebook(sessionID) {
  var session = sessions[sessionID];
  var page = session.page;

  // WAIT FOR AND CLICK GRADEBOOK BUTTON
  // Note: Gradebook launch button is clicked to authenticate realistic login.
  await page.waitForSelector('#ctl00_ContentArea_Btn_Gradebook');
  await page.click('#ctl00_ContentArea_Btn_Gradebook');

  // WAIT FOR GRADEBOOK FRAME
  await page.waitForSelector('#ctl00_ContentArea_frame_GS'); //iframe now exists, but has not loaded grades yet
  const gradeframe = await page.mainFrame().childFrames()[0]; // Assumes first child frame is the gradeframe
  await gradeframe.waitForNavigation(); // Waits for the gradeframe to navigate to the gradeframe url
  // CACHE TO AUTHENTICATE IS IN PLACE, NAVIGATE TO GRADEBOOK
  await page.goto(GRADEFRAME_URL);

  // ClICK GRADES BUTTON
  await page.waitForSelector('#lnkGrades');
  await page.click('#lnkGrades');
}

async function scrapeUndetailedGrades(sessionID) {
  var session = sessions[sessionID];
  var page = session.page;


  // Approach: Use HTML content to parse grid information, assume standard structure for selectors
  var HTML_CONTENT = session.pageContent;
  HTML_CONTENT = await page.content();

  // Assuming: Row structure as TEACHER | NOTES | COURSE | PERIOD | CYCLE1 | CYCLE2 | EXAM1 | SEM1 | CYCLE3 | CYCLE4 | EXAM2 | SEM2

  // Gather Table Metadata
  var tabledata = session.tabledata;
  var nonEmptyCells = session.nonEmptyCells;

  // Parses out individual rows of the table (or classes)
  const HTML_Rows = HTML_CONTENT.match(/<tr class="DataRow.*?<\/tr>/gs);
  tabledata.n_classes = HTML_Rows.length;

  for (var TABLE_Y = 0; TABLE_Y < HTML_Rows.length; TABLE_Y++) {
    let HTML_Row = HTML_Rows[TABLE_Y];
    var row = {};

    let teacherName = HTML_Row.match(/(?<=(TeacherNameCell">)).*?(?=(<\/th))/)[0];
    row['TEACHER'] = teacherName;

    // Cells Parsed Out From <td>. Teacher name cell is in <th> so this is everything after that.
    const HTML_Cells = HTML_Row.match(/<td.*?<\/td>/gs);
    let assumedStructure = ['NOTES', 'COURSE', 'PERIOD', 'CYCLE1', 'CYCLE2', 'EXAM1', 'SEM1', 'CYCLE3', 'CYCLE4', 'EXAM2', 'SEM2'];

    // Cycle Through Each Cell
    for (var TABLE_X = 1; TABLE_X < HTML_Cells.length; TABLE_X++) { // Starting at 1 to skip notes
      let cellTitle = assumedStructure[TABLE_X];
      let content = innertext(HTML_Cells[TABLE_X]);
      row[cellTitle] = content;

      // Flag Non-Empty Cells
      if (cellTitle.includes('CYCLE') && content != ' ') {
        let flaggedCell = {
          cellTitle: cellTitle,
          row: "TABLEROW_" + TABLE_Y,
          selectorRow: TABLE_Y + 2,
          selectorCell: TABLE_X + 2
        }
        nonEmptyCells.push(flaggedCell);
      }
    }

    // Add DETAILED subpath for later
    row.DETAILED = {};

    tabledata["TABLEROW_" + TABLE_Y] = row;
  }

  return tabledata;
}

async function scrapeDetailedGrades(sessionID) {
  var session = sessions[sessionID];
  var page = session.page;
  var HTML_CONTENT = session.pageContent;
  var tabledata = session.tabledata;
  var nonEmptyCells = session.nonEmptyCells;

  // Open Flagged (non-empty) Cells and Scrape Contents
  for (let flaggedCell of nonEmptyCells) {
    // Create Cell Selector Using Assumed Format
    let selector = "#_ctl0_tdMainContent > table > tbody > tr:nth-child(" + flaggedCell.selectorRow + ") > td:nth-child(" + flaggedCell.selectorCell + ") > a";
    await page.waitForSelector(selector);
    await page.click(selector);

    // Wait For Heading To Appear Indicating Load Complete
    await page.waitForSelector("#_ctl0_tdMainContent > h3");

    // Scrape
    // NOTE: Table Format Can Be Variable. EX: Calculus vs US Hist Have Different Headers.
    // Must dynamically adjust for any table format.

    HTML_CONTENT = await page.content();

    // Seperate Out Tables
    var assignmentsTables = [];
    let HTML_AssignmentsTables = HTML_CONTENT.match(/<span class="CategoryName".*?<\/span>.*?<table.*?<\/table>/gs);

    for (let HTML_AssignmentsTable of HTML_AssignmentsTables) {
      var assignmentsTable = {};

      // Parse Table Title (Includes Percentage)
      assignmentsTable.title = HTML_AssignmentsTable.match(/(?<=(<span class="CategoryName")).*?(?=(<\/span>))/gs)[0];

      // Seperate Table Header, Which Includes Titles For All The Columns
      var columnTitles = [];
      var HTML_ColumnTitles = HTML_AssignmentsTable.match(/<th.*?<\/th>/gs);
      for (let HTML_ColumnTitle of HTML_ColumnTitles) {
        columnTitles.push(innertext(HTML_ColumnTitle));
      }
      assignmentsTable.columnTitles = columnTitles;

      // Seperate Out Assignments
      let HTML_Assignments = HTML_AssignmentsTable.match(/<tr class="DataRow.*?<\/tr>/gs);

      // No Assignments Check
      var Assignments_N = 0;
      if (HTML_Assignments != null) {
        Assignments_N = HTML_Assignments.length;
      }

      assignmentsTable.assignments = [];
      for (var ASSIGNMENT_N = 0; ASSIGNMENT_N < Assignments_N; ASSIGNMENT_N++) {
        var assignment = {};
        let HTML_Assignment = HTML_Assignments[ASSIGNMENT_N];

        // Seperate Out Cells In Assignment
        let HTML_AssignmentCells = HTML_Assignment.match(/<td.*?<\/td>/gs);
        for (var COLUMN_N = 0; COLUMN_N < HTML_AssignmentCells.length; COLUMN_N++) {
          let cellText = innertext(HTML_AssignmentCells[COLUMN_N]);
          assignment[columnTitles[COLUMN_N]] = cellText;
        }
        assignmentsTable.assignments.push(assignment);
      }

      // Parse Out Average
      let average = HTML_AssignmentsTable.match(/(?<=(<td>Average<\/td><td>)).*?(?=(<\/td>))/gs)[0];
      assignmentsTable.average = average;

      assignmentsTables.push(assignmentsTable);
    }
    console.log(assignmentsTables);

    // Append Final assignments tables Into tabledata
    var row = tabledata[flaggedCell.row];
    row.DETAILED[flaggedCell.cellTitle] = assignmentsTables;
  }
  /////////////////////////////////////
  /// VARIABLE STRUCTURE MARKER END ///
  /////////////////////////////////////

  return tabledata;
}

async function getData(input_username, input_password) {
  var sessionID = await createSession(input_username, input_password);
  await initializeSession(sessionID);
  await navigateAndAttemptLogin(sessionID);
  await openGradebook(sessionID);
  await scrapeUndetailedGrades(sessionID);
  await scrapeDetailedGrades(sessionID);
}




// EXPORTS

module.exports = {
  initializeApp: initializeApp,
  getUserSnapshot: getData
};
