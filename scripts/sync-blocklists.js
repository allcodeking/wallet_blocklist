import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { Buffer } from "buffer";
import fs from "fs";
import path from "path";
import {testBlocklist} from "./test-blocklist.js";
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchUpstreamSheet() {
  const credentialsJSON = Buffer.from(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
    "base64"
  ).toString("utf8");
  const credentials = JSON.parse(credentialsJSON);

  const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.MYSTEN_SPREEDSHEET_ID;
  const range = "Sheet1!A:H";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const spreadsheetData = response.data.values;
  return {
    coin: extractAddressByType(spreadsheetData, "Coin"),
    object: extractAddressByType(spreadsheetData, "NFT").concat(
      extractAddressByType(spreadsheetData, "Object")
    ),
    package: extractAddressByType(spreadsheetData, "Package"),
    domain: extractAddressByType(spreadsheetData, "Domain"),
  };
}

function extractAddressByType(data, type) {
  // Filter out table headers and empty rows
  const filteredData = data.filter(
    (row) => row.length !== 0 && row[0] !== "Type"
  );

  // Define a function to determine if the address meets the format criteria based on type
  const meetsFormatCriteria = (row) => {
    if (row[0] === type) {
      if (type === "NFT" || type === "Coin" || type === "Object") {
        return row[2].includes("::");
      } else if (type === "Package") {
        return !row[2].includes("::");
      } else if (type === "Domain") {
        if (!row[2].startsWith("http://") && !row[2].startsWith("https://")) {
          row[2] = "http://" + row[2];
        }
        try {
          const hostname = new URL(row[2]).hostname.toLowerCase();
          row[2] = hostname; // Update row[2] with the hostname
          return true;
        } catch (error) {
          console.error("Invalid URL for Domain:", row[2], error);
          return false;
        }
      }
    }
    return false;
  };

  // Extract addresses of the specified type
  const addresses = filteredData
    .filter((row) => meetsFormatCriteria(row))
    .map((row) => row[2]); // Formatted Address is in the third column

  return addresses;
}

async function fetchGardians() {
  const url = "https://raw.githubusercontent.com/suiet/guardians/main/dist/";
  const fileNames = ["coin-list.json", "domain-list.json", "object-list.json", "package-list.json"];
  const guardiansData = {};

  for (const fileName of fileNames) {
    const fileUrl = url + fileName;
    const response = await fetch(fileUrl, { method: "GET" });
    const jsonData = await response.json();
    guardiansData[fileName.replace("-list.json", "")] = jsonData;
  }

  return guardiansData;
}

async function fetchBlocklists() {
  const url = process.env.BLOCKLISTS_URL;
  const token = 'token ' + process.env.READ_ACCESS_TOKEN;

  const fileNames = ["coin-list.json", "domain-list.json", "object-list.json", "package-list.json"];
  const blocklistData = {};

  for (const fileName of fileNames) {
    const fileUrl = url + fileName;
    const response = await fetch(fileUrl, { method: "GET", headers: { "Authorization": token } });
    const jsonData = await response.json();
    blocklistData[fileName.replace("-list.json", "")] = jsonData;
  }

  return blocklistData;
}

function updateFile(spreadsheetData, gardiansData, blocklistData) {
  const types =  ["coin", "domain", "object", "package"];
  console.log(types);
  let fail = false;
  types.forEach((type) => {
    const filePath = path.resolve(
      __dirname,
      `../blocklists/${type.toLowerCase()}-list.json`
    );
    // Read the existing JSON file
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(`Read ${type}-list.json successfully.`);
    } catch (error) {
      console.error(`Error reading file for ${type}:`, error);
      return;
    }

    // Merge new addresses into blocklist, sort and deduplicate
    const updatedBlocklist = Array.from(
      new Set([...data.blocklist, ...gardiansData[type].blocklist, ...spreadsheetData[type], ...blocklistData[type].blocklist])
    );
    updatedBlocklist.sort();

    console.log(`Checking ${type} for false positives.`);
    const false_positive = testBlocklist(updatedBlocklist, type, __dirname);
    if (false_positive) {
      console.error(`Blocklist for ${type} found false positive:`, false_positive);
      fail = true;
      return;
    }
    
    // Update blocklist and write back to the file
    data.blocklist = updatedBlocklist;
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      console.log(`${type}-list.json updated successfully.`);
    } catch (error) {
      console.error(`Error writing file for ${type}:`, error);
    }
  });

  return fail;
}

async function run() {
  const shouldFetchSheet = process.env.SHOULD_FETCH_SHEET;
  let sheetData = {"coin":[],"object":[],"package":[],"domain":[]};
  if (shouldFetchSheet === "true") {
    sheetData = await fetchUpstreamSheet();
  }
  
  const gardiansData = await fetchGardians();
  const blocklistData = await fetchBlocklists();
  const errors = updateFile(sheetData, gardiansData, blocklistData);
  process.exitCode = errors ? 1 : 0;
  // console.log(sheetData)
}

run().catch(console.error);