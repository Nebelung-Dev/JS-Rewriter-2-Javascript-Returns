import { parse } from "acorn";
import { parse as parseLoose } from "acorn-loose";
import { ancestor as walk } from "acorn-walk";
import { generate } from "astring";

const globals = new Set([
  "window",
  "self",
  "globalThis",
  "this",
  "parent",
  "top",
  "location",
  "document",
  "opener",
]);

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

function oldEclipseRewriter(code) {
  let ast;
  try {
    ast = parse(code, acornOptions);
  } catch {
    ast = parseLoose(code, acornOptions);
  }

  function shouldReplaceIdentifier(node, parent) {
    if (globals.has(node.name)) {
      if (parent && parent.type === "Property" && parent.key === node) {
        return false;
      }

      if (
        parent &&
        parent.type === "MemberExpression" &&
        parent.property === node
      ) {
        return false;
      }

      if (
        parent &&
        (parent.type === "VariableDeclarator" ||
          parent.type === "AssignmentExpression" ||
          parent.type === "BinaryExpression")
      ) {
        return false;
      }

      return true;
    }
    return false;
  }

  walk(ast, {
    Identifier(node, ancestors) {
      //@ts-ignore
      const parent = ancestors[ancestors.length - 2];
      if (shouldReplaceIdentifier(node, parent)) {
        node.name = `$${node.name}`;
      }
    },

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

export { oldEclipseRewriter };
