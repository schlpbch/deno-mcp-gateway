# Feature Plan: Server Configuration Upload UI

## Overview
Add a user interface to upload and manage MCP server configurations directly from the web UI, eliminating the need for command-line tools.

## User Workflows

### Workflow 1: Upload Configuration File
1. User opens the gateway web UI
2. Navigates to "Servers" or "Configuration" tab
3. Clicks "Upload Config File"
4. Selects `servers-config.json` or similar
5. File is parsed and validated
6. UI shows preview of servers to be added
7. User clicks "Confirm Upload"
8. Servers are registered via API
9. Success message shown, servers list updates

### Workflow 2: Manual Server Entry
1. User opens the gateway web UI
2. Navigates to server management section
3. Clicks "Add Server" button
4. Form appears with fields:
   - Server ID (text)
   - Server Name (text)
   - Endpoint URL (text)
   - Requires Session (checkbox)
5. User fills in details
6. Clicks "Register Server"
7. Server is registered via API
8. Server appears in active servers list

### Workflow 3: View and Manage Servers
1. User opens gateway web UI
2. Views list of currently registered servers
3. For each server:
   - Server ID, Name, Endpoint
   - Health status
   - Delete button (optional)
4. Can filter/search servers
5. Can export current configuration

## UI Components Needed

### 1. Server Configuration Page
- **Route**: `/servers` or `/config`
- **Sections**:
  - Active Servers List (read-only)
  - Upload Configuration Panel
  - Manual Entry Form
  - Health Status Monitor

### 2. Upload Panel Component
```
┌─────────────────────────────────┐
│ 📤 Upload Configuration File     │
├─────────────────────────────────┤
│ Drag & drop or click to browse   │
│ [Browse Files...]               │
│                                 │
│ Supported formats: JSON          │
│ Max size: 10MB                   │
└─────────────────────────────────┘
```

### 3. Manual Entry Form Component
```
┌─────────────────────────────────┐
│ ➕ Add Server Manually           │
├─────────────────────────────────┤
│ Server ID:     [____________]    │
│ Server Name:   [____________]    │
│ Endpoint URL:  [____________]    │
│ Requires Session: ☐              │
│                                 │
│ [Cancel] [Register Server]      │
└─────────────────────────────────┘
```

### 4. Servers List Component
```
┌─────────────────────────────────┐
│ 📊 Active Servers (3)            │
├─────────────────────────────────┤
│ ✓ journey-service               │
│   Endpoint: http://localhost... │
│   Status: HEALTHY               │
│   [Delete]                      │
│                                 │
│ ✓ swiss-mobility                │
│   Endpoint: http://localhost... │
│   Status: HEALTHY               │
│   [Delete]                      │
│                                 │
│ ✓ open-meteo                    │
│   Endpoint: http://localhost... │
│   Status: DOWN                  │
│   [Delete]                      │
└─────────────────────────────────┘
```

## Backend Changes Needed

### 1. File Upload Endpoint (New)
**Endpoint**: `POST /mcp/servers/upload`

**Request**:
- Content-Type: multipart/form-data
- File field: `config` (JSON file)

**Response**:
```json
{
  "success": true,
  "uploaded": 3,
  "failed": 0,
  "servers": [
    { "id": "journey", "name": "Journey Service" },
    { "id": "swiss-mobility", "name": "Swiss Mobility" }
  ],
  "errors": []
}
```

### 2. List Servers Endpoint (Exists)
**Endpoint**: `GET /mcp/servers/register`

Returns all registered servers (already exists).

### 3. Delete Server Endpoint (New - Optional)
**Endpoint**: `DELETE /mcp/servers/{serverId}`

**Response**:
```json
{
  "success": true,
  "message": "Server deleted"
}
```

### 4. Get Server Health Endpoint (New - Optional)
**Endpoint**: `GET /mcp/servers/{serverId}/health`

Returns health status of a specific server.

## File Format Handling

### Input: `servers-config.json`
```json
{
  "servers": [
    {
      "id": "journey",
      "name": "Journey Service",
      "endpoint": "http://localhost:3001/mcp",
      "requiresSession": true
    }
  ]
}
```

### Validation
- ✓ Valid JSON format
- ✓ Has `servers` array
- ✓ Each server has required fields (id, name, endpoint)
- ✓ Valid endpoint URL format
- ✓ No duplicate server IDs

### Error Handling
- Invalid JSON → Show error message
- Missing servers array → Show error
- Missing fields → List which servers have issues
- Invalid URLs → Highlight specific servers
- Duplicate IDs → Warn and allow override

## Implementation Plan

### Phase 1: Backend (API Endpoints)
**Tasks**:
1. Create `POST /mcp/servers/upload` endpoint
   - Parse multipart/form-data
   - Extract JSON file
   - Validate configuration
   - Register servers via existing API
   - Return results

2. Create `DELETE /mcp/servers/{serverId}` endpoint
   - Remove server from registry
   - Return success/error

3. Create `GET /mcp/servers/{serverId}/health` endpoint
   - Return current health status
   - Last check timestamp

### Phase 2: Frontend (UI Components)
**Tasks**:
1. Create `/servers` or `/config` page
2. Build Upload Panel component
   - Drag & drop file upload
   - File validation
   - Success/error handling

3. Build Manual Entry Form
   - Form validation
   - Real-time URL validation
   - Submit handler

4. Build Servers List
   - Fetch from API
   - Display with health status
   - Delete buttons (optional)
   - Auto-refresh (polling or WebSocket)

5. Add navigation link to UI

### Phase 3: Polish
- Error messages and notifications
- Loading states
- Form validation feedback
- Success confirmations
- Export configuration feature

## Files to Create/Modify

### New Files
```
src/
  ├── endpoints/
  │   ├── serverUpload.ts          # POST /mcp/servers/upload
  │   ├── serverDelete.ts          # DELETE /mcp/servers/{id}
  │   └── serverHealth.ts          # GET /mcp/servers/{id}/health
  └── ui/
      ├── pages/
      │   └── ServersPage.tsx       # Main servers management page
      ├── components/
      │   ├── UploadPanel.tsx       # File upload component
      │   ├── ManualEntryForm.tsx   # Manual server entry form
      ├── └── ServersList.tsx       # Servers list display
      └── hooks/
          └── useServers.ts         # Server data fetching hook
```

### Modified Files
- `main.ts` - Add new endpoints
- `README.md` - Document new UI feature
- Web UI main app - Add navigation link

## Success Criteria

✅ **Functionality**
- User can upload JSON config file
- User can manually add servers
- User can see all registered servers
- User can delete servers
- Real-time server status display

✅ **User Experience**
- Clear error messages
- Intuitive interface
- Fast file upload
- No page reload required (smooth UI)

✅ **Code Quality**
- TypeScript strict mode compliance
- Error handling for all cases
- Input validation
- API error responses

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Backend endpoints | 2-3 hours |
| 2 | Frontend components | 4-5 hours |
| 3 | Polish & testing | 2-3 hours |
| **Total** | | **8-11 hours** |

## Future Enhancements

- [ ] Edit existing servers
- [ ] Server configuration presets/templates
- [ ] Auto-discovery of servers on network
- [ ] Configuration versioning/history
- [ ] Import/export configurations
- [ ] Server grouping/tagging
- [ ] Advanced health monitoring dashboard
- [ ] Server logs viewer
- [ ] Configuration validation schema

## Related Documentation

- [Server Registry](./REGISTRY.md)
- [Upload Server Config Script](./docs/UPLOAD_SERVER_CONFIG.md)
- [Architecture](./ARCHITECTURE.md)
- [Bash Script](./scripts/upload-server-config.sh)

## Questions to Answer

1. Should we support editing existing servers?
2. Should we allow deleting servers via UI?
3. Should we persist server configs to disk?
4. Should we show real-time health monitoring?
5. Should we support importing from URL?
6. Should we use polling or WebSocket for updates?
