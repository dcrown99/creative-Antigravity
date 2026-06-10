# 📜 Scripts Directory

This directory contains PowerShell scripts for managing the Antigravity Ultimate Edition project.
Adhering to the **Script Supremacy** rule, these scripts should be used for all operational tasks.

## 🛠️ Management & Development

| Script | Description |
| :--- | :--- |
| `dev_manager.ps1` | **Primary Interface.** Manage individual containers or **Service Stacks** (Quant/Clipper/Voice). |
| `launch_system.ps1` | Starts the entire system (all containers). |
| `redeploy_all.ps1` | Redeploys all services (down -> up). |
| `restart_docker.ps1` | Restarts the Docker Desktop backend and optionally rebuilds containers. |

### Service Stacks (Profile) Usage
You can launch specific groups of services using the `-Stack` parameter or the interactive menu (Options 9-11).

```powershell
# Launch only Quant Brain and DBs
./scripts/dev_manager.ps1 -Stack "quant"

# Launch only Video Clipping services
./scripts/dev_manager.ps1 -Stack "clipper"
``` |

## 🔍 Verification & Testing

| Script | Description |
| :--- | :--- |
| `verify_system.ps1` | Health check for all containers and ports. |
| `verify_gold_master.ps1` | Runs linting, type checking, and builds (CI/CD simulation). |
| `verify_e2e.ps1` | Runs End-to-End tests. |

## 🧹 Maintenance & Setup

| Script | Description |
| :--- | :--- |
| `cleanup_project.ps1` | Cleans up `node_modules`, `.next` caches, and build artifacts. |
| `setup_drive.ps1` | Mounts the external drive (H:) to WSL (`/mnt/h`). |
| `sync_github.ps1` | Synchronizes local changes to GitHub (add, commit, push). |

## 🔄 Utilities

| Script | Description |
| :--- | :--- |
| `gitingest.ps1` | **[NEW]** Wrapper for `gitingest`. Generates a codebase digest without PATH modification. |
| `migrate_imports.ps1` | Helper to migrate import paths during refactoring. |
| `prepare_public_release.ps1` | Prepares the repository for public release (sanitization). |

## 📝 Usage Examples

### Using `gitingest.ps1`
```powershell
# Generate digest for the current directory
./scripts/gitingest.ps1 .

# Show help
./scripts/gitingest.ps1 --help
```
