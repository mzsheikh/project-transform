const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const contractsRoot = path.resolve(projectRoot, "../../packages/contracts");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [contractsRoot];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
  "react-native-web": path.resolve(workspaceRoot, "node_modules/react-native-web"),
  "@contracts": contractsRoot,
};

// The admin Next.js app uses a different React version in the workspace root.
// Prevent Metro from resolving that second React copy, otherwise hooks fail at runtime.
config.resolver.blockList = [
  new RegExp(`${escapePath(path.resolve(workspaceRoot, "node_modules/react"))}/.*`),
  new RegExp(`${escapePath(path.resolve(workspaceRoot, "node_modules/react-dom"))}/.*`),
];

module.exports = config;

function escapePath(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
