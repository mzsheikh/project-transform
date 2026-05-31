import { Module } from "@nestjs/common";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorsService } from "./connectors.service";
import { SecretVaultService } from "./secret-vault.service";
import { ConnectorFactory } from "./runtime/connector.factory";
import { FormDatabaseMappingsService } from "./form-database-mappings.service";

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorsService, SecretVaultService, ConnectorFactory, FormDatabaseMappingsService],
  exports: [ConnectorsService, ConnectorFactory, FormDatabaseMappingsService],
})
export class ConnectorsModule {}
