import { Field, ObjectType } from "@nestjs/graphql";
import { GraphQLISODateTime } from "@nestjs/graphql";
import { JsonScalarType } from "./json.scalar";

@ObjectType()
export class AppType {
  @Field()
  appCode!: string;

  @Field()
  name!: string;

  @Field(() => JsonScalarType, { nullable: true })
  settings?: unknown;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class FormType {
  @Field()
  id!: string;

  @Field()
  appCode!: string;

  @Field()
  formKey!: string;

  @Field()
  version!: number;

  @Field()
  status!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => JsonScalarType, { nullable: true })
  schemaJson?: unknown;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class AppWithForms {
  @Field(() => AppType)
  app!: AppType;

  @Field(() => [FormType])
  forms!: FormType[];
}
