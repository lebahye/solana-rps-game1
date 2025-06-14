{ pkgs }: {
  deps = [
    # Rust dependencies
    pkgs.rustc
    pkgs.cargo
    pkgs.rustfmt
    pkgs.libiconv
    pkgs.rust-analyzer
    pkgs.clippy

    # Solana dependencies
    pkgs.solana-cli
    pkgs.libudev
    pkgs.pkg-config
    pkgs.openssl
    pkgs.libclang
    pkgs.llvm

    # Node.js dependencies
    pkgs.nodejs-18_x
    pkgs.nodePackages.npm
    pkgs.yarn
    
    # Build tools
    pkgs.gnumake
    pkgs.cmake
    pkgs.gcc
    pkgs.binutils

    # Development utilities
    pkgs.git
    pkgs.curl
    pkgs.wget
    pkgs.jq
    
    # For React frontend
    pkgs.vite
  ];

  env = {
    RUST_BACKTRACE = "1";
    RUSTFLAGS = "-C link-arg=-s";
    ANCHOR_VERSION = "0.29.0";
    SOLANA_VERSION = "1.17.0";
    NODE_ENV = "development";
    PATH = "$HOME/.cargo/bin:$PATH";
  };

  # Install Anchor CLI on Replit startup
  onBoot = ''
    echo "Installing Anchor CLI version $ANCHOR_VERSION..."
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
    
    echo "Setting up Solana configuration..."
    mkdir -p $HOME/.config/solana
    solana config set --url localhost
    
    echo "Creating keypair if it doesn't exist..."
    if [ ! -f $HOME/.config/solana/id.json ]; then
      solana-keygen new --no-bip39-passphrase -o $HOME/.config/solana/id.json
    fi
    
    echo "Environment setup complete!"
  '';
}
