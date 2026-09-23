# Scenarios

Scenarios execute dependent HTTP requests sequentially.

They are useful when one request creates data needed by later requests.

## Example

```js
scenarios: [
  {
    name:
      'user lifecycle',

    steps: [
      {
        name:
          'create user',

        method:
          'POST',

        path:
          '/users',

        body: {
          email:
            'yellow-jacket@example.test'
        },

        expect: {
          status: 201
        },

        capture: {
          userId:
            '$.id'
        }
      },

      {
        name:
          'get user',

        method:
          'GET',

        path:
          '/users/{{userId}}',

        expect: {
          status: 200
        }
      },

      {
        name:
          'update user',

        method:
          'PATCH',

        path:
          '/users/{{userId}}',

        body: {
          id:
            '{{userId}}',

          active:
            true
        },

        expect: {
          status: 200
        }
      },

      {
        name:
          'delete user',

        method:
          'DELETE',

        path:
          '/users/{{userId}}',

        expect: {
          status: 204
        }
      }
    ]
  }
]
```

## Capture response values

Values can be captured from JSON responses:

```js
capture: {
  userId:
    '$.id'
}
```

The variable becomes available to subsequent steps in the same scenario.

## Reuse variables in paths

```js
path:
  '/users/{{userId}}'
```

## Reuse variables in headers

```js
headers: {
  'x-user-id':
    '{{userId}}'
}
```

## Reuse variables in request bodies

```js
body: {
  id:
    '{{userId}}'
}
```

When a placeholder represents the entire JSON value, Yellow Jacket preserves
the captured value's original type.

For example, a numeric `userId` remains a number.

## Embedded variables

Variables can also appear inside a string:

```text
/users/{{userId}}/profile
```

In this case the value is converted to text.

## Failure behavior

A scenario stops when:

- a request fails
- an expected status does not match
- a variable cannot be resolved
- a capture path cannot be resolved

This prevents later steps from running with invalid state.

## Scenario isolation

Captured variables are isolated between scenarios.

A variable created in one scenario is not available in another.

## Safety

Mutating scenario steps use the same action guard as normal routes.

Requests such as:

```text
POST
PUT
PATCH
DELETE
```

are restricted to localhost and loopback targets by default. `.local` mDNS
names are not implicitly trusted.

Redirects that preserve a mutating method are checked before the next request
is sent.

To explicitly authorize another environment:

```bash
yellow-jacket run \
  --allow-actions
```
