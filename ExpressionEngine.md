# Expression Engine

Project Transform supports Excel-style expressions in form schemas. Any dynamic
property is written as a string that starts with `=`.

Expressions are safe and allowlisted. They do not run JavaScript, do not call
external services, and cannot use `eval`, macros, `INDIRECT`, `RAND`, or `NOW`.

## Quick Start

Use expressions in control `props` or supported validation rules:

```json
{
  "key": "total",
  "controlType": "number",
  "props": {
    "value": "=SUM(NUMBER(amount1), NUMBER(amount2))",
    "readOnly": true
  }
}
```

```json
{
  "key": "notes",
  "controlType": "text",
  "props": {
    "enabled": "=NOT(ISBLANK(amount1))"
  }
}
```

If a normal text value must begin with `=`, prefix it with an apostrophe:

```json
{
  "props": {
    "placeholder": "'=this is literal text, not a formula"
  }
}
```

At runtime the leading apostrophe is removed.

## Where Expressions Can Be Used

Expressions can be used in dynamic control properties such as:

- `props.value`
- `props.defaultValue`
- `props.enabled`
- `props.disabled`
- `props.readOnly`
- `props.visible`
- `props.visibleWhen`
- `props.required`
- `props.placeholder`
- `props.helpText`
- numeric props such as `min`, `max`, `step`, `precision`, `fontSize`
- validation rules such as `validation.required`, `validation.min`, `validation.max`, `validation.minLength`, `validation.maxLength`, `validation.maxItems`

Use `props.value` for live calculated fields. The calculated value is written
back into form data and is enforced again by the backend on submission.

Use `props.defaultValue` only for initialization. It is evaluated when the field
is empty, but it does not keep recalculating after the user edits the field.

Use `props.enabled` as the preferred positive API. Do not define both
`props.enabled` and `props.disabled` on the same control.

## Referencing Fields

For normal field keys, reference the key directly:

```text
=amount1 + amount2
```

Field keys are case-sensitive. Function names and keywords are case-insensitive,
but uppercase names are recommended for readability.

For field keys that contain spaces, hyphens, or other non-identifier characters,
use `FIELD("key")`:

```text
=FIELD("line-total") + FIELD("tax amount")
```

Inside repeaters, bare names resolve against the current row first and then the
root form data.

Use explicit repeater helpers when the scope needs to be clear:

```text
=ITEM("amount")
=ROOT("siteName")
=ROW()
=SUM(ITEMS("expenses", "amount"))
```

## Variables

Button and list view actions can store variables with the `set_variable`
action. Variables are available to expressions through:

```text
=VAR("selectedCustomerId")
=ROWVAR("rowTotal")
=FORMVAR("inspectionMode")
=GLOBALVAR("siteId")
```

Scopes:

- `row`: available during the current tapped row/action chain.
- `form`: available while the current form is open.
- `global`: persisted locally on the device for the current app and available
  when another form is opened.

Example button action that stores a selected customer id globally:

```json
{
  "id": "action_store_customer",
  "type": "set_variable",
  "scope": "global",
  "key": "customerId",
  "value": "=FIELD(\"customerId\")"
}
```

Example expression in another form:

```text
=GLOBALVAR("customerId")
```

## Data Source Binding And List Views

Data-source rows are available through `DATA("sourceKey")`. A list view control
can render those rows, and row templates can use `ITEM("columnName")`.

Example list view:

```json
{
  "key": "customersList",
  "controlType": "listview",
  "label": "Customers",
  "props": {
    "data": "=DATA(\"customers\")",
    "keyField": "id",
    "title": "=ITEM(\"name\")",
    "subtitle": "=ITEM(\"email\")",
    "actions": [
      {
        "id": "select_customer",
        "type": "set_variable",
        "scope": "global",
        "key": "customerId",
        "value": "=ITEM(\"id\")"
      },
      {
        "id": "open_inspection",
        "type": "open_form",
        "formKey": "inspection"
      }
    ]
  }
}
```

Example dropdown options from a data source:

```text
=OPTIONS(DATA("customers"), "name", "id")
```

Example read-only selected customer name:

```text
=LOOKUP(DATA("customers"), "id", GLOBALVAR("customerId"), "name")
```

## Literals

Supported literal values:

```text
=123
=12.5
="hello"
='hello'
=TRUE
=FALSE
=NULL
=BLANK
```

`NULL` and `BLANK` both evaluate to a blank value.

## Operators

Supported operators:

| Operator | Meaning | Example |
| --- | --- | --- |
| `+` | Add numbers | `=amount + tax` |
| `-` | Subtract numbers | `=subtotal - discount` |
| `*` | Multiply numbers | `=qty * unitPrice` |
| `/` | Divide numbers | `=total / count` |
| `%` | Remainder | `=count % 2` |
| `^` | Power | `=base ^ exponent` |
| `&` | Concatenate text | `=firstName & " " & lastName` |
| `=` or `==` | Equal | `=status = "approved"` |
| `!=` or `<>` | Not equal | `=status <> "rejected"` |
| `<`, `<=`, `>`, `>=` | Compare values | `=score >= 70` |
| `AND` | Boolean and | `=required AND approved` |
| `OR` | Boolean or | `=urgent OR overdue` |
| `NOT` | Boolean not | `=NOT(ISBLANK(email))` |

Use parentheses for clarity:

```text
=(amount1 + amount2) * taxRate
```

Operator precedence, from highest to lowest:

1. Parentheses
2. Unary `+`, unary `-`, `NOT`
3. `^`
4. `*`, `/`, `%`
5. `+`, `-`
6. `&`
7. Comparisons
8. `AND`
9. `OR`

## Type Conversion Rules

Numeric functions and numeric operators convert values using these rules:

- Blank values become `0`.
- Numbers stay numbers.
- Booleans become `1` or `0`.
- Numeric strings such as `"12.5"` become numbers.
- Non-numeric text causes a formula error.

Boolean conversion rules:

- Blank values become `FALSE`.
- Numbers are `FALSE` only when `0`.
- Text values `true`, `yes`, `y`, and `1` become `TRUE`.
- Text values `false`, `no`, `n`, `0`, and empty text become `FALSE`.
- Other text causes a formula error.

Text conversion rules:

- Blank values become empty text.
- Numbers and booleans become their string form.
- Lists become comma-separated text.
- Objects become JSON text.

Date functions return dates as `YYYY-MM-DD` strings.

## Common Examples

### Add Two Number Fields

```json
{
  "key": "total",
  "controlType": "number",
  "props": {
    "value": "=SUM(NUMBER(amount1), NUMBER(amount2))",
    "readOnly": true
  }
}
```

### Enable A Field Only After Another Field Is Filled

```json
{
  "key": "notes",
  "controlType": "text",
  "props": {
    "enabled": "=NOT(ISBLANK(amount1))"
  }
}
```

### Make A Field Required Conditionally

```json
{
  "key": "rejectionReason",
  "controlType": "text",
  "props": {
    "multiline": true,
    "required": "=status = \"rejected\"",
    "visible": "=status = \"rejected\""
  }
}
```

### Calculate A Percentage

```json
{
  "key": "completionPercent",
  "controlType": "number",
  "props": {
    "value": "=IF(totalTasks = 0, 0, ROUND(completedTasks / totalTasks * 100, 2))",
    "readOnly": true
  }
}
```

### Build Display Text

```json
{
  "key": "fullName",
  "controlType": "text",
  "props": {
    "value": "=TRIM(firstName & \" \" & lastName)",
    "readOnly": true
  }
}
```

### Change Options Dynamically

```json
{
  "key": "priority",
  "controlType": "dropdown",
  "props": {
    "options": "=IF(isEmergency, OPTIONS(\"High\", \"high\", \"Critical\", \"critical\"), OPTIONS(\"Normal\", \"normal\", \"Low\", \"low\"))"
  }
}
```

### Disable An Option

```json
{
  "key": "status",
  "controlType": "dropdown",
  "props": {
    "options": "=OPTIONS(OPTION(\"Draft\", \"draft\"), OPTION(\"Published\", \"published\", NOT(canPublish)))"
  }
}
```

### Use A Repeater Total

```json
{
  "key": "expenseTotal",
  "controlType": "number",
  "props": {
    "value": "=SUM(ITEMS(\"expenses\", \"amount\"))",
    "readOnly": true
  }
}
```

### Use Current Row In A Repeater

```json
{
  "key": "lineTotal",
  "controlType": "number",
  "props": {
    "value": "=NUMBER(qty) * NUMBER(unitPrice)",
    "readOnly": true
  }
}
```

### Add Date Logic

```json
{
  "key": "dueDate",
  "controlType": "date",
  "props": {
    "defaultValue": "=DATEADD(TODAY(), 7, \"days\")"
  }
}
```

```json
{
  "key": "daysOpen",
  "controlType": "number",
  "props": {
    "value": "=DATEDIFF(openDate, TODAY(), \"days\")",
    "readOnly": true
  }
}
```

## Function Reference

### Field And Repeater Functions

| Function | Returns | Example |
| --- | --- | --- |
| `FIELD(key)` | Value for a field key string | `=FIELD("line-total")` |
| `ROOT(key)` | Value from root form data | `=ROOT("siteName")` |
| `ITEM(key)` | Value from current repeater row | `=ITEM("amount")` |
| `ITEMS(repeaterKey, fieldKey)` | List of values from repeater rows | `=ITEMS("expenses", "amount")` |
| `ROW()` | Current repeater row number, starting at 1 | `=ROW()` |

### Variable Functions

| Function | Returns | Example |
| --- | --- | --- |
| `VAR(name)` | First matching row, form, then global variable | `=VAR("customerId")` |
| `ROWVAR(name)` | Current row variable | `=ROWVAR("selectedSku")` |
| `FORMVAR(name)` | Current form variable | `=FORMVAR("mode")` |
| `GLOBALVAR(name)` | App-wide local variable | `=GLOBALVAR("siteId")` |

### Dataset Functions

| Function | Description | Example |
| --- | --- | --- |
| `DATA(key)` | Rows for a form data source | `=DATA("customers")` |
| `FIRST(list)` | First item or blank | `=FIRST(DATA("customers"))` |
| `FILTER(rows, field, value)` | Rows where a field equals a value | `=FILTER(DATA("customers"), "status", "active")` |
| `LOOKUP(rows, keyField, keyValue, returnField)` | Finds one row and returns one field | `=LOOKUP(DATA("customers"), "id", customerId, "name")` |
| `PLUCK(rows, field)` | List of field values | `=PLUCK(DATA("customers"), "name")` |
| `OPTION_LABEL(rows, keyField, keyValue, labelField)` | Display label for a selected id | `=OPTION_LABEL(DATA("customers"), "id", customerId, "name")` |
| `PATH(object, path)` | Nested object value | `=PATH(FIRST(DATA("profile")), "address.city")` |
| `SORT(rows, field)` | Sorted rows | `=SORT(DATA("customers"), "name")` |
| `TAKE(rows, count)` | First N rows | `=TAKE(DATA("customers"), 20)` |

### Math Functions

| Function | Description | Example |
| --- | --- | --- |
| `SUM(value, ...)` | Adds all values. Lists are flattened. | `=SUM(a, b, ITEMS("lines", "amount"))` |
| `AVG(value, ...)` | Average of all values. Lists are flattened. | `=AVG(score1, score2, score3)` |
| `MIN(value, ...)` | Smallest numeric value. | `=MIN(price1, price2)` |
| `MAX(value, ...)` | Largest numeric value. | `=MAX(score1, score2)` |
| `ROUND(value, digits)` | Rounds a number. `digits` defaults to `0`. | `=ROUND(total, 2)` |
| `FLOOR(value)` | Rounds down. | `=FLOOR(quantity)` |
| `CEILING(value)` | Rounds up. | `=CEILING(quantity)` |
| `ABS(value)` | Absolute value. | `=ABS(balance)` |

### Logic Functions

| Function | Description | Example |
| --- | --- | --- |
| `IF(condition, trueValue, falseValue)` | Returns one of two values. The false value is optional. | `=IF(score >= 70, "Pass", "Fail")` |
| `IFS(condition1, value1, condition2, value2, ...)` | Returns the first value with a true condition. | `=IFS(score >= 90, "A", score >= 80, "B", TRUE, "C")` |
| `IFERROR(value, fallback)` | Returns fallback if the first expression errors. | `=IFERROR(total / count, 0)` |
| `AND(value, ...)` | True when every value is true. | `=AND(required, approved)` |
| `OR(value, ...)` | True when any value is true. | `=OR(urgent, overdue)` |
| `NOT(value)` | Boolean negation. | `=NOT(isComplete)` |
| `COALESCE(value, ...)` | First non-blank value. | `=COALESCE(preferredName, legalName, "Unknown")` |

### Type And Check Functions

| Function | Description | Example |
| --- | --- | --- |
| `ISBLANK(value)` | True for null, empty text, or empty lists. | `=ISBLANK(notes)` |
| `ISNUMBER(value)` | True for numeric values. | `=ISNUMBER(amount)` |
| `ISTEXT(value)` | True for text values. | `=ISTEXT(name)` |
| `ISDATE(value)` | True when value can be parsed as a date. | `=ISDATE(startDate)` |
| `ISBOOLEAN(value)` | True for booleans. | `=ISBOOLEAN(approved)` |
| `NUMBER(value)` | Converts to number or raises an error. | `=NUMBER(amountText)` |
| `TEXT(value)` | Converts to text. | `=TEXT(amount)` |
| `BOOLEAN(value)` | Converts to boolean or raises an error. | `=BOOLEAN(answer)` |

### Text Functions

| Function | Description | Example |
| --- | --- | --- |
| `CONCAT(value, ...)` | Joins values as text. | `=CONCAT(firstName, " ", lastName)` |
| `TRIM(text)` | Removes leading and trailing spaces. | `=TRIM(name)` |
| `UPPER(text)` | Uppercase text. | `=UPPER(code)` |
| `LOWER(text)` | Lowercase text. | `=LOWER(email)` |
| `LEN(text)` | Text length. | `=LEN(notes)` |
| `LEFT(text, count)` | First `count` characters. | `=LEFT(code, 3)` |
| `RIGHT(text, count)` | Last `count` characters. | `=RIGHT(accountNumber, 4)` |
| `CONTAINS(text, search)` | True when text contains search text. | `=CONTAINS(email, "@")` |

### Date Functions

| Function | Description | Example |
| --- | --- | --- |
| `TODAY()` | Current date as `YYYY-MM-DD`. | `=TODAY()` |
| `DATE(year, month, day)` | Builds a date string. | `=DATE(2026, 5, 23)` |
| `DATEADD(date, amount, unit)` | Adds days, months, or years. | `=DATEADD(startDate, 30, "days")` |
| `DATEDIFF(start, end, unit)` | Difference in days, months, or years. | `=DATEDIFF(startDate, endDate, "days")` |
| `YEAR(date)` | Year number. | `=YEAR(startDate)` |
| `MONTH(date)` | Month number, 1 to 12. | `=MONTH(startDate)` |
| `DAY(date)` | Day of month. | `=DAY(startDate)` |

Date units can be written as singular or plural values such as `"day"`,
`"days"`, `"month"`, `"months"`, `"year"`, or `"years"`.

### List And Select Functions

| Function | Description | Example |
| --- | --- | --- |
| `IN(value, option, ...)` | True when value equals one of the options. | `=IN(status, "open", "pending")` |
| `COUNT(value, ...)` | Counts non-blank values. Lists are flattened. | `=COUNT(a, b, c)` |
| `HAS(list, value)` | True when a list contains value. | `=HAS(selectedServices, "inspection")` |
| `HASANY(list, value, ...)` | True when list contains any value. | `=HASANY(tags, "urgent", "blocked")` |
| `HASALL(list, value, ...)` | True when list contains all values. | `=HASALL(requiredDocs, "id", "photo")` |
| `LIST(value, ...)` | Builds a list. | `=LIST("a", "b", "c")` |
| `OPTION(label, value, disabled)` | Builds one option. `disabled` is optional. | `=OPTION("High", "high", FALSE)` |
| `OPTIONS(value, ...)` | Builds dropdown or multiselect options. | `=OPTIONS("High", "high", "Low", "low")` |

`OPTIONS` supports two styles:

```text
=OPTIONS("High", "high", "Low", "low")
```

```text
=OPTIONS(OPTION("High", "high"), OPTION("Low", "low", TRUE))
```

## Validation And Error Rules

Publishing rejects invalid expressions, unknown references, controls that define
both `enabled` and `disabled`, and calculated value cycles.

Submission validation recomputes calculated values. If submitted calculated
values were changed by the client, the backend rejects the submission.

Known property outputs are type-checked:

- boolean props such as `enabled`, `readOnly`, `required`, and `visible` must return booleans
- numeric props such as `min`, `max`, `step`, and `precision` must return numbers
- `options` must return an array of option objects
- `props.value` must match the control submission type

`props.value` must not depend on its own control key or create a cycle with
other calculated values.

Formula errors never crash rendering. The UI records the formula error for the
affected field or property, and strict backend paths reject invalid publish or
submission requests.

## Recommended Patterns

Prefer explicit conversion when data may come from text inputs:

```text
=NUMBER(amount1) + NUMBER(amount2)
```

Guard divisions:

```text
=IF(count = 0, 0, total / count)
```

Use `COALESCE` for fallbacks:

```text
=COALESCE(displayName, legalName, "Unknown")
```

Use `enabled` instead of `disabled` for new formulas:

```text
=NOT(ISBLANK(customerName))
```

Keep calculated fields read-only:

```json
{
  "props": {
    "value": "=SUM(ITEMS(\"expenses\", \"amount\"))",
    "readOnly": true
  }
}
```
