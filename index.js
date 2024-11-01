import { createRequire } from "node:module";
import { parse } from "acorn";
import { parse as parseLoose } from "acorn-loose";
import { generate } from "astring";
import { ancestor as walk } from "acorn-walk";
import { oldEclipseRewriter } from "./oldEclipseRewriter.js";

const require = createRequire(import.meta.url);
const detect = require("acorn-globals");

const globals = [
  "window",
  "self",
  "globalThis",
  "this",
  "parent",
  "top",
  "location",
  "document",
  "frames",
];

const acornOptions = {
  sourceType: "module",
  allowImportExportEverywhere: true,
  allowAwaitOutsideFunction: true,
  allowReturnOutsideFunction: true,
  allowSuperOutsideMethod: true,
  checkPrivateFields: false,
  locations: false,
  ranges: false,
  ecmaVersion: "latest",
  preserveParens: false,
  allowReserved: true,
};

//obv not real encode function
function encodeURL(url) {
  return "https://proxysite.com/go/" + url;
}

function rewrite(code) {
  let ast;
  try {
    ast = parse(code, acornOptions);
  } catch {
    ast = parseLoose(code, acornOptions);
  }

  const scope = detect(ast);

  for (let global of scope) {
    if (globals.includes(global.name)) {
      global.nodes.forEach((node) => {
        if (node.type === "Identifier") {
          node.name = "$" + node.name;
        }
      });
    }
  }

  walk(ast, {
    ImportDeclaration(node) {
      if (node.source) {
        node.source.raw = `"${encodeURL(String(node.source.value))}"`;
      }
    },

    ExportNamedDeclaration(node) {
      if (node.source) {
        node.source.raw = `"${encodeURL(String(node.source.value))}"`;
      }
    },

    ExportAllDeclaration(node) {
      if (node.source) {
        node.source.raw = `"${encodeURL(String(node.source.value))}"`;
      }
    },

    ImportExpression(node) {
      if (node.source.type === "Literal") {
        node.source.raw = `"${encodeURL(String(node.source.value))}"`;
      } else {
        node.source = {
          type: "CallExpression",
          callee: {
            type: "Identifier",
            name: "$encodeURL",
          },
          arguments: [node.source],
        };
      }
    },
  });

  return generate(ast);
}

const code = `
import { data } from 'https://example.com/data.js'

const moreData = import('https://data.com/moredata.js')

const url = "https://example.com/test.js"
const dataFromVar = import(url)

console.log(location.href)
console.log(self.location.href)

const exampleArray = [globalThis]
console.log(exampleArray[0].location.href)

const exampleObject = {
  self: "abc",
  realLocation: location
}
console.log(exampleObject.realLocation)

function getLocation(location, self, window) {
  console.log(location)
  console.log(self, window, globalThis)
}

getLocation(location)

export * as test from "https://somewebsite.com/test.js"
`;

console.log(rewrite(code));
//old Eclipse JS rewriter for testing
//console.log(oldEclipseRewriter(code));