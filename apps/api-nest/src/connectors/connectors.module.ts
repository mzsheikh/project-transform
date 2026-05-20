import { Module } from "@nestjs/common";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorsService } from "./connectors.service";
import { SecretVaultService } from "./secret-vault.service";
import { ConnectorFactory } from "./runtime/connector.factory";

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorsService, SecretVaultService, ConnectorFactory],
  exports: [ConnectorsService, ConnectorFactory],
})
export class ConnectorsModule {}
