import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { AppsModule } from "../apps/apps.module";
import { FormsModule } from "../forms/forms.module";
import { AppFormsResolver } from "./app-forms.resolver";
import { JsonScalar, JsonScalarType } from "./json.scalar";

@Module({
  imports: [
    AppsModule,
    FormsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      buildSchemaOptions: {
        // Map generic JS objects to the custom JSON scalar.
        scalarsMap: [{ type: Object, scalar: JsonScalarType }],
      },
      playground: process.env.NODE_ENV !== "production",
      introspection: process.env.NODE_ENV !== "production",
    }),
  ],
  providers: [AppFormsResolver, JsonScalar],
})
export class AppGraphqlModule {}
