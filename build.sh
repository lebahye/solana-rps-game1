#!/bin/bash

# Comprehensive Build and Deployment Script for Solana RPS Game

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
ARTIFACTS_DIR="artifacts"
REPLIT_PACKAGE_NAME="solana_rps_replit_package.zip"
FRONTEND_DIR="frontend"
BACKEND_PROGRAM_DIR="backend/solana-program"
BACKEND_PROGRAM_NAME="solana_rps" # Name of the .so file (without extension)

# Log Colors
RESET="\033[0m"
BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"

# --- Logger Functions ---
log_info() {
  echo -e "${BLUE}${BOLD}[INFO]${RESET} $1"
}
log_success() {
  echo -e "${GREEN}${BOLD}[SUCCESS]${RESET} $1"
}
log_warn() {
  echo -e "${YELLOW}${BOLD}[WARN]${RESET} $1"
}
log_error() {
  echo -e "${RED}${BOLD}[ERROR]${RESET} $1" >&2
}
log_step() {
  echo -e "\n${CYAN}${BOLD}>>> STEP: $1${RESET}"
}

# --- Helper Functions ---
check_command() {
  if ! command -v "$1" &> /dev/null; then
    log_error "$1 command not found. Please install it and ensure it's in your PATH."
    exit 1
  fi
}

validate_env_vars() {
  log_step "Validating Environment Variables"
  local all_vars_ok=true

  if [ -f .env ]; then
    log_info "Loading environment variables from .env file."
    # shellcheck disable=SC1091
    set -a
    source .env
    set +a
  else
    log_warn ".env file not found. Please create one from .env.example."
    # Continue with defaults or expect them to be globally set
  fi

  if [ -z "$VITE_RPC_ENDPOINT" ]; then
    log_warn "VITE_RPC_ENDPOINT is not set. Defaulting to Solana Devnet for some operations."
    # It's a warning because for 'replit' target, it might be set in Replit UI
  fi

  # VITE_RPS_PROGRAM_ID might be set after deployment, so we don't fail here
  # but we will remind the user.
  if [ -z "$VITE_RPS_PROGRAM_ID" ]; then
    log_warn "VITE_RPS_PROGRAM_ID is not set. You'll need to set this after deploying the Solana program."
  else
    log_info "VITE_RPS_PROGRAM_ID is set to: $VITE_RPS_PROGRAM_ID"
  fi

  log_info "Environment variable check complete."
}

check_tools() {
  log_step "Checking for Required Tools"
  check_command "node"
  check_command "npm" # or bun
  check_command "cargo"
  check_command "rustc"
  check_command "solana"
  # ts-node is required for the testing suite
  check_command "ts-node"
  log_success "All required tools are available."
}

# --- Build Functions ---
build_backend() {
  log_step "Building Backend (Solana Program)"
  if [ ! -d "$BACKEND_PROGRAM_DIR" ]; then
    log_error "Backend directory '$BACKEND_PROGRAM_DIR' not found."
    exit 1
  fi
  cd "$BACKEND_PROGRAM_DIR"
  log_info "Running 'cargo build-bpf'..."
  if cargo build-bpf --program-name "$BACKEND_PROGRAM_NAME"; then
    cd ../.. # Back to root
    # Copy artifact
    mkdir -p "$ARTIFACTS_DIR/backend"
    local so_file_path
    so_file_path=$(find "$BACKEND_PROGRAM_DIR/target/deploy" -name "${BACKEND_PROGRAM_NAME}.so" | head -n 1)
    if [ -z "$so_file_path" ]; then
        log_error "Could not find compiled .so file for '${BACKEND_PROGRAM_NAME}'."
        exit 1
    fi
    cp "$so_file_path" "$ARTIFACTS_DIR/backend/${BACKEND_PROGRAM_NAME}.so"
    log_success "Backend built successfully. Artifact: $ARTIFACTS_DIR/backend/${BACKEND_PROGRAM_NAME}.so"
  else
    log_error "Backend build failed."
    cd ../.. # Back to root
    exit 1
  fi
}

build_frontend() {
  log_step "Building Frontend"
  if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "Frontend directory '$FRONTEND_DIR' not found."
    exit 1
  fi
  cd "$FRONTEND_DIR"
  log_info "Installing frontend dependencies (npm install)..."
  if npm install --legacy-peer-deps; then # Using --legacy-peer-deps for wider compatibility
    log_info "Building frontend (npm run build)..."
    if npm run build; then
      cd .. # Back to root
      # Copy artifact
      mkdir -p "$ARTIFACTS_DIR/frontend"
      cp -r "$FRONTEND_DIR/dist" "$ARTIFACTS_DIR/frontend/dist"
      # Copy sound assets for deployments that serve static files
      if [ -d "$FRONTEND_DIR/sounds" ]; then
        mkdir -p "$ARTIFACTS_DIR/frontend/dist/sounds"
        cp -r "$FRONTEND_DIR/sounds" "$ARTIFACTS_DIR/frontend/dist/"
      else
        log_warn "Sounds directory not found in frontend. Audio effects may be missing."
      fi
      log_success "Frontend built successfully. Artifacts in $ARTIFACTS_DIR/frontend/dist"
    else
      log_error "Frontend build failed."
      cd .. # Back to root
      exit 1
    fi
  else
    log_error "Frontend dependency installation failed."
    cd .. # Back to root
    exit 1
  fi
}

# --- Test Functions ---
run_tests() {
  log_step "Running Comprehensive Test Suite"
  if [ ! -d "testing" ]; then
    log_warn "Testing directory not found. Skipping tests."
    return
  fi
  pushd testing >/dev/null
  if ! npm install --silent; then
    log_error "Failed to install testing dependencies."
    popd >/dev/null
    return 1
  fi
  if npm run run-all-mock-tests; then
    log_success "All mock tests completed."
  else
    log_warn "Some tests failed. Review output above."
  fi
  popd >/dev/null
}

# --- Deployment Functions ---
deploy_solana_program() {
  local network_url=$1
  local network_name=$2
  local program_so_path="$ARTIFACTS_DIR/backend/${BACKEND_PROGRAM_NAME}.so"

  log_step "Deploying Solana Program to $network_name ($network_url)"
  if [ ! -f "$program_so_path" ]; then
    log_error "Solana program artifact '$program_so_path' not found. Build the backend first."
    exit 1
  fi

  log_info "Attempting to deploy '$program_so_path'..."
  local deploy_output
  if deploy_output=$(solana program deploy --url "$network_url" "$program_so_path"); then
    local program_id
    program_id=$(echo "$deploy_output" | grep "Program Id:" | awk '{print $3}')
    if [ -n "$program_id" ]; then
      log_success "Solana program deployed to $network_name successfully!"
      log_info "${BOLD}Program ID: $program_id${RESET}"
      log_warn "IMPORTANT: Update VITE_RPS_PROGRAM_ID in your .env file (and Replit secrets if applicable) with this Program ID."
      echo "$program_id" > "$ARTIFACTS_DIR/backend/last_deployed_program_id.txt"
    else
      log_error "Failed to extract Program ID from deployment output."
      log_info "Deployment output: $deploy_output"
      exit 1
    fi
  else
    log_error "Solana program deployment to $network_name failed."
    exit 1
  fi
}

package_for_replit() {
  log_step "Packaging for Replit Deployment"
  
  if [ ! -d "$ARTIFACTS_DIR/frontend/dist" ] || [ ! -f "$ARTIFACTS_DIR/backend/${BACKEND_PROGRAM_NAME}.so" ]; then
    log_warn "Frontend or backend artifacts not found. Building them first."
    build_backend
    build_frontend
  fi

  log_info "Creating Replit package: $REPLIT_PACKAGE_NAME"
  
  # Replit typically builds from source, so we'll package the source code primarily.
  # The .replit file should handle the build process within Replit.
  # We'll include essential files for Replit to clone and run.
  
  # Create a temporary directory for packaging
  local temp_package_dir="replit_package_temp"
  rm -rf "$temp_package_dir"
  mkdir -p "$temp_package_dir"

  # Copy necessary files and directories
  log_info "Copying files to temporary packaging directory..."
  cp -r "$BACKEND_PROGRAM_DIR" "$temp_package_dir/backend"
  cp -r "$FRONTEND_DIR" "$temp_package_dir/frontend"
  cp -r "testing" "$temp_package_dir/testing" # Include testing scripts
  
  # Root files
  for file in package.json package-lock.json .replit .gitignore README.md DEPLOYMENT.md .env.example; do
    if [ -f "$file" ]; then
      cp "$file" "$temp_package_dir/"
    else
      log_warn "Root file '$file' not found, skipping for Replit package."
    fi
  done
  
  # Optionally include pre-built artifacts if Replit setup might not build them
  # mkdir -p "$temp_package_dir/$ARTIFACTS_DIR/backend"
  # cp "$ARTIFACTS_DIR/backend/${BACKEND_PROGRAM_NAME}.so" "$temp_package_dir/$ARTIFACTS_DIR/backend/"
  # mkdir -p "$temp_package_dir/$ARTIFACTS_DIR/frontend"
  # cp -r "$ARTIFACTS_DIR/frontend/dist" "$temp_package_dir/$ARTIFACTS_DIR/frontend/"

  # Create the zip file
  if zip -r "$REPLIT_PACKAGE_NAME" "$temp_package_dir"; then
    log_success "Replit package created: $REPLIT_PACKAGE_NAME"
    log_info "This package contains the source code and configuration for Replit."
    log_info "You can either:"
    log_info "1. Import the GitHub repository directly into Replit."
    log_info "2. Upload this ZIP to a new Replit project (less common for source-based builds)."
  else
    log_error "Failed to create Replit package."
  fi
  
  # Clean up temporary directory
  rm -rf "$temp_package_dir"
}

# --- Main Script Logic ---
main() {
  TARGET="help" # Default target
  if [ -n "$1" ]; then
    TARGET=$1
  fi

  log_info "Starting Solana RPS Game Build Script..."
  log_info "Selected Target: $TARGET"

  # Create artifacts directory if it doesn't exist
  mkdir -p "$ARTIFACTS_DIR"

  validate_env_vars
  check_tools

  case "$TARGET" in
    "backend")
      build_backend
      ;;
    "frontend")
      build_frontend
      ;;
    "all")
      build_backend
      build_frontend
      run_tests
      log_success "Backend and Frontend built successfully."
      ;;
    "local")
      build_backend
      # build_frontend # Frontend usually run in dev mode for local
      log_warn "For local deployment:"
      log_info "1. Ensure Solana test validator is running: 'solana-test-validator'"
      log_info "2. Deploy the program using: $0 deploy-program-local"
      log_info "3. Start the frontend dev server: 'cd $FRONTEND_DIR && npm run dev'"
      ;;
    "deploy-program-local")
      build_backend # Ensure it's built
      deploy_solana_program "http://127.0.0.1:8899" "Local Test Validator"
      ;;
    "devnet")
      build_backend
      build_frontend # Build frontend for static deployment
      deploy_solana_program "https://api.devnet.solana.com" "Devnet"
      log_info "Frontend (from $ARTIFACTS_DIR/frontend/dist) can now be deployed to a static host (e.g., Netlify, Vercel, GitHub Pages)."
      ;;
    "mainnet")
      log_warn "${BOLD}CAUTION: You are targeting MAINNET.${RESET}"
      read -r -p "Are you sure you want to deploy to Mainnet? This may incur real costs. (yes/no): " confirmation
      if [ "$confirmation" != "yes" ]; then
        log_info "Mainnet deployment cancelled by user."
        exit 0
      fi
      build_backend
      build_frontend
      deploy_solana_program "https://api.mainnet-beta.solana.com" "Mainnet Beta"
      log_info "Frontend (from $ARTIFACTS_DIR/frontend/dist) can now be deployed to a static host."
      ;;
    "replit")
      # This target focuses on ensuring the project is ready for Replit's build system.
      # It can also create a package for manual upload if needed.
      log_info "Preparing project for Replit..."
      # Ensure essential Replit config files are present
      if [ ! -f ".replit" ]; then
          log_error ".replit file not found. This is crucial for Replit deployment."
          exit 1
      fi
      if [ ! -f "$FRONTEND_DIR/package.json" ]; then # Replit usually runs frontend from its dir
          log_error "$FRONTEND_DIR/package.json not found."
          exit 1
      fi
      # Build artifacts to ensure they are up-to-date if someone wants to use them
      build_backend
      build_frontend
      package_for_replit # Create a zip as a convenience/backup
      log_success "Project is structured for Replit. Ensure VITE_RPC_ENDPOINT and VITE_RPS_PROGRAM_ID are set in Replit Secrets."
      log_info "Replit will typically build the Solana program and frontend from source using commands in .replit and package.json."
      ;;
    "clean")
      log_step "Cleaning up artifacts and build directories"
      rm -rf "$ARTIFACTS_DIR"
      rm -f "$REPLIT_PACKAGE_NAME"
      # Additional cleanup to free Replit disk space
      log_info "Removing Rust build cache (target) and node_modules cache..."
      if [ -d "$BACKEND_PROGRAM_DIR/target" ]; then
        log_info "Cleaning backend target directory..."
        (cd "$BACKEND_PROGRAM_DIR" && cargo clean)
      fi
      if [ -d "$FRONTEND_DIR/dist" ]; then
        log_info "Cleaning frontend dist directory..."
        rm -rf "$FRONTEND_DIR/dist"
      fi
      if [ -d "$FRONTEND_DIR/node_modules" ]; then
        log_info "Cleaning frontend node_modules directory..."
        rm -rf "$FRONTEND_DIR/node_modules"
      fi
      log_success "Cleanup complete."
      ;;
    "test")
      run_tests
      ;;
    "help"|*)
      echo -e "${BOLD}Solana RPS Game Build Script Usage:${RESET}"
      echo "  $0 <target>"
      echo ""
      echo -e "${BOLD}Available Targets:${RESET}"
      echo -e "  ${GREEN}backend${RESET}             Builds only the Solana program."
      echo -e "  ${GREEN}frontend${RESET}            Builds only the frontend application."
      echo -e "  ${GREEN}all${RESET}                 Builds both backend and frontend."
      echo -e "  ${GREEN}local${RESET}               Prepares for local development and testing (builds backend)."
      echo -e "  ${GREEN}deploy-program-local${RESET} Deploys Solana program to local test validator."
      echo -e "  ${GREEN}devnet${RESET}              Builds all and deploys Solana program to Devnet."
      echo -e "  ${GREEN}mainnet${RESET}             Builds all and deploys Solana program to Mainnet (with confirmation)."
      echo -e "  ${GREEN}replit${RESET}              Prepares project for Replit, builds artifacts, and creates a Replit source package."
      echo -e "  ${GREEN}clean${RESET}               Removes build artifacts and cleans target directories."
      echo -e "  ${GREEN}help${RESET}                Shows this help message."
      echo ""
      echo -e "${BOLD}Prerequisites:${RESET}"
      echo "  - Node.js, npm (or bun)"
      echo "  - Rust, Cargo"
      echo "  - Solana CLI"
      echo "  - Ensure .env file is configured (see .env.example)."
      ;;
  esac

  log_info "Build script finished."
}

# Run the main function with all script arguments
main "$@"
