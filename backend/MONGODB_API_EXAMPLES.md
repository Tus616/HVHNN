# HVHN MongoDB API Examples

## Community

`POST /communities`

```json
{
  "name": "Test Community",
  "description": "Hello from HVHN",
  "location": "City",
  "category": "general"
}
```

## Member Role Update

`PUT /communities/{communityId}/members/{memberId}`

```json
{
  "role": "MODERATOR"
}
```

## Community Request

`POST /communities/{communityId}/requests`

```json
{
  "title": "Need food packets",
  "description": "Need 20 food packets for affected families",
  "location": "Noida Sector 62",
  "urgency": "HIGH"
}
```

## Community Request Update

`PUT /requests/{requestId}`

```json
{
  "description": "Request accepted and volunteers are on the way",
  "status": "ACCEPTED"
}
```
