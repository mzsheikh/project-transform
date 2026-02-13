const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const contractsRoot = path.resolve(projectRoot, "../../packages/contracts");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [contractsRoot];
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, "node_modules/react"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
  "react-native-web": path.resolve(workspaceRoot, "node_modules/react-native-web"),
  "@contracts": contractsRoot,
};

module.exports = config;
