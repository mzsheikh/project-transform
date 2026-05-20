import { Injectable } from "@nestjs/common";
import {
  BaseDatabaseConnector,
  BaseRestConnector,
  ConnectorRuntimeConfig,
} from "./base-connectors";
import {
  MysqlDatabaseConnector,
  PostgresDatabaseConnector,
  SqlServerDatabaseConnector,
} from "./database-connectors";
import { RestApiConnector } from "./rest-connector";

@Injectable()
export class ConnectorFactory {
  database(config: ConnectorRuntimeConfig): BaseDatabaseConnector {
    if (config.type !== "database") {
      throw new Error("Connector is not a database connector");
    }
    switch (config.provider) {
      case "postgresql":
        return new PostgresDatabaseConnector(config);
      case "mysql":
        return new MysqlDatabaseConnector(config);
      case "sqlserver":
        return new SqlServerDatabaseConnector(config);
      default:
        throw new Error("Database connector requires provider");
    }
  }

  rest(config: ConnectorRuntimeConfig): BaseRestConnector {
    if (config.type !== "rest_api") {
      throw new Error("Connector is not a REST API connector");
    }
    return new RestApiConnector(config);
  }
}
