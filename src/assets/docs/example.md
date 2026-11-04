# Lexikon SQL API Documentation

This documentation provides an overview of the FastAPI-based SQL API for the `lexikon.db` database.

## Overview

The API provides full CRUD (Create, Read, Update, Delete) operations for two main tables:
- `lexikon`: A dictionary of words and their definitions.
- `budget_items`: A list of items with pricing, categories, and status.

## Authentication

All endpoints are secured using **HTTP Basic Authentication**.

- **Username**: `admin`
- **Password**: `password`

You must include the `Authorization: Basic <base64_credentials>` header in all requests.

## Base URL

When running locally, the base URL is:
`http://localhost:8000`

Interactive API documentation (Swagger UI) is available at:
`http://localhost:8000/docs`

---

## API Endpoints

### Lexikon Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/lexikon/` | List all lexikon items (supports `skip` and `limit` parameters). |
| `GET` | `/lexikon/{id}` | Get a specific lexikon item by ID. |
| `POST` | `/lexikon/` | Create a new lexikon item. |
| `PUT` | `/lexikon/{id}` | Update an existing lexikon item. |
| `DELETE` | `/lexikon/{id}` | Delete a lexikon item. |

#### Lexikon Schema
```json
{
  "word": "string",
  "definition": "string"
}
```

---

### Budget Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/budget/` | List all budget items (supports `skip` and `limit` parameters). |
| `GET` | `/budget/{id}` | Get a specific budget item by ID. |
| `POST` | `/budget/` | Create a new budget item. |
| `PUT` | `/budget/{id}` | Update an existing budget item. |
| `DELETE` | `/budget/{id}` | Delete a budget item. |

#### Budget Item Schema
```json
{
  "url": "string (optional)",
  "name": "string",
  "price": 0.0,
  "currency": "CHF (default)",
  "image": "string (optional)",
  "description": "string (optional)",
  "quantity": 1 (default),
  "category": "Allgemein (default)",
  "bought": 0 (default)
}
```

---

## How to Run

1. Ensure you have the required dependencies installed:
   ```bash
   pip install fastapi uvicorn sqlalchemy
   ```

2. Start the API server:
   ```bash
   python main.py
   ```

3. The server will start at `http://0.0.0.0:8000`.

## Example Request (curl)

```bash
curl -X GET "http://localhost:8000/lexikon/" \
     -H "accept: application/json" \
     -u admin:password
```
