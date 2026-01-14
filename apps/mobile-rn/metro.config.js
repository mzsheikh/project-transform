const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const contractsRoot = path.resolve(projectRoot, "../../packages/contracts");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [contractsRoot];
config.resolver.extraNodeModules = {
  "@contracts": contractsRoot,
};

module.exports = config;
