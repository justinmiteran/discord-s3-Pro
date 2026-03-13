# Discord Storage CLI

A specialized PowerShell interface designed to interact with the Discord Storage Backend API.

## Directory Structure

```text
FrontendPowershell/         # Client-side application
+-- cli.ps1

````

## Command Reference

The script supports the following actions via the `-Action` parameter:

| Action     | Description                       | Example Usage                        |
| ---------- | --------------------------------- | ------------------------------------ |
| `upload`   | Uploads a local file to the cloud | `-Action upload -Path "C:\file.zip"` |
| `list`     | Displays all stored files         | `-Action list`                       |
| `download` | Retrieves a file by ID            | `-Action download -Id <uuid>`        |
| `delete`   | Permanently removes a file        | `-Action delete -Id <uuid>`          |
| `status`   | Checks server and bot health      | `-Action status`                     |

## Operational Requirements

The CLI communicates with the API at `http://localhost:3000`. The Backend service must be active for these commands to function.