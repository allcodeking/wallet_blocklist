import path from "path";
import {testBlocklist} from "./test-blocklist.js";
import { fileURLToPath } from 'url';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function updateFile(blocklistData) {
  const types =  ["coin", "domain", "object", "package"];
  console.log(types);
  let fail = false;
  types.forEach((type) => {
    const filePath = path.resolve(
      __dirname,
      `../blocklists/${type.toLowerCase()}-list.json`
    );
    console.log(`Checking ${type} for false positives.`);
    const false_positive = testBlocklist(blocklistData[type].blocklist, type, __dirname);
    if (false_positive) {
      console.error(`Blocklist for ${type} found false positive:`, false_positive);
      fail = true;
      return;
    }

    if(type ==="domain") {
      blocklistData[type].allowlist = []
    }
    
    // Update blocklist and write back to the file
    try {
      fs.writeFileSync(filePath, JSON.stringify(blocklistData[type], null, 2), "utf8");
      console.log(`${type}-list.json updated successfully.`);
    } catch (error) {
      console.error(`Error writing file for ${type}:`, error);
    }
  });

  return fail;
}

async function run() {
  const blocklistData = await fetchBlocklists();
  const errors = updateFile(blocklistData);
  process.exitCode = errors ? 1 : 0;
  // console.log(sheetData)
}

run().catch(console.error);