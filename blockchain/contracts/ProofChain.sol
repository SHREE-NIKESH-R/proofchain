// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProofChain
/// @notice Stores ownership-proof metadata for AI-generated digital assets.
/// @dev No file content is ever stored on-chain — only proof/metadata (hash, owner, timestamp).
///      This contract does NOT determine originality or similarity; that is handled off-chain
///      by the Multimodal Originality Engine. This contract only answers:
///      "Who registered this content, and when?"
contract ProofChain {
    enum VerificationStatus {
        Active,
        Escrowed,
        Resolved,
        Rejected
    }

    struct Asset {
        bytes32 assetId;       // keccak256-derived unique id, generated off-chain, checked for collisions here
        bytes32 contentHash;   // SHA-256 hash of the original content
        address owner;         // current owner wallet
        address registeredBy;  // original registrant, immutable
        uint256 timestamp;     // block timestamp at registration
        string contentType;    // "prompt" | "article" | "image" | "music" | "video"
        string aiModel;        // user-declared metadata, e.g. "Midjourney", "Human-created"
        VerificationStatus status; // current verification state (active, escrowed, resolved, rejected)
        bool active;           // false if the asset has been deactivated (reserved for future use)
    }

    struct Dispute {
        bytes32 assetId;
        address claimant;
        bytes32 timestampProof;
        string reason;
        uint256 createdAt;
        uint256 resolvedAt;
        bool active;
        bool accepted;
    }

    // assetId => Asset
    mapping(bytes32 => Asset) private assets;
    // assetId => existence flag (separate from `active` so we can distinguish "never registered" from "deactivated")
    mapping(bytes32 => bool) private registered;
    // assetId => chronological list of owners (index 0 = original registrant)
    mapping(bytes32 => address[]) private ownershipHistory;
    // assetId => dispute record for the current active or settled ownership conflict
    mapping(bytes32 => Dispute) private disputes;
    // assetId => whether a dispute is currently open
    mapping(bytes32 => bool) private disputeOpen;

    event AssetRegistered(
        bytes32 indexed assetId,
        address indexed owner,
        bytes32 contentHash,
        string contentType,
        string aiModel,
        uint256 timestamp
    );

    event OwnershipTransferred(
        bytes32 indexed assetId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event DisputeRaised(
        bytes32 indexed assetId,
        address indexed claimant,
        bytes32 timestampProof,
        uint256 timestamp
    );

    event AssetEscrowed(
        bytes32 indexed assetId,
        address indexed claimant,
        uint256 timestamp
    );

    event DisputeResolved(
        bytes32 indexed assetId,
        bool accepted,
        uint256 timestamp
    );

    modifier onlyAssetOwner(bytes32 assetId) {
        require(registered[assetId], "ProofChain: asset not registered");
        require(assets[assetId].owner == msg.sender, "ProofChain: caller is not the owner");
        _;
    }

    /// @notice Registers a new asset's ownership proof on-chain.
    /// @param assetId Unique identifier for the asset, computed off-chain (e.g. keccak256 of contentHash + owner + salt).
    /// @param contentHash SHA-256 hash of the underlying content (fingerprint, not the content itself).
    /// @param contentType One of the supported content types.
    /// @param aiModel User-declared AI model metadata (not verified on-chain).
    function registerAsset(
        bytes32 assetId,
        bytes32 contentHash,
        string calldata contentType,
        string calldata aiModel
    ) external {
        require(!registered[assetId], "ProofChain: assetId already registered");
        require(contentHash != bytes32(0), "ProofChain: contentHash required");
        require(bytes(contentType).length > 0, "ProofChain: contentType required");

        assets[assetId] = Asset({
            assetId: assetId,
            contentHash: contentHash,
            owner: msg.sender,
            registeredBy: msg.sender,
            timestamp: block.timestamp,
            contentType: contentType,
            aiModel: aiModel,
            status: VerificationStatus.Active,
            active: true
        });

        registered[assetId] = true;
        ownershipHistory[assetId].push(msg.sender);

        emit AssetRegistered(assetId, msg.sender, contentHash, contentType, aiModel, block.timestamp);
    }

    /// @notice Lists the current verification state for an asset.
    function getVerificationStatus(bytes32 assetId) public view returns (VerificationStatus) {
        require(registered[assetId], "ProofChain: asset not registered");
        return assets[assetId].status;
    }

    /// @notice Alias for dispute workflow integration; returns the current asset status.
    function getAssetStatus(bytes32 assetId) public view returns (VerificationStatus) {
        require(registered[assetId], "ProofChain: asset not registered");
        return assets[assetId].status;
    }

    /// @notice Raises a dispute against an asset and immediately escrows verification while evidence is reviewed.
    function raiseDispute(
        bytes32 assetId,
        address claimant,
        bytes32 timestampProof,
        string calldata reason
    ) public returns (bytes32 disputeId) {
        require(registered[assetId], "ProofChain: asset not registered");
        require(claimant != address(0), "ProofChain: claimant required");
        require(timestampProof != bytes32(0), "ProofChain: timestamp proof required");
        require(bytes(reason).length > 0, "ProofChain: reason required");
        require(!disputeOpen[assetId], "ProofChain: dispute already open");

        disputes[assetId] = Dispute({
            assetId: assetId,
            claimant: claimant,
            timestampProof: timestampProof,
            reason: reason,
            createdAt: block.timestamp,
            resolvedAt: 0,
            active: true,
            accepted: false
        });
        disputeOpen[assetId] = true;
        assets[assetId].status = VerificationStatus.Escrowed;

        emit DisputeRaised(assetId, claimant, timestampProof, block.timestamp);
        emit AssetEscrowed(assetId, claimant, block.timestamp);

        return assetId;
    }

    /// @notice Alias used by callers that prefer an "open dispute" naming convention.
    function openDispute(
        bytes32 assetId,
        address claimant,
        bytes32 timestampProof,
        string calldata reason
    ) public returns (bytes32) {
        return raiseDispute(assetId, claimant, timestampProof, reason);
    }

    /// @notice Alias used by callers that prefer a generic "submit dispute" naming convention.
    function submitDispute(
        bytes32 assetId,
        address claimant,
        bytes32 timestampProof,
        string calldata reason
    ) public returns (bytes32) {
        return raiseDispute(assetId, claimant, timestampProof, reason);
    }

    /// @notice Places an asset into escrow without a dispute record (for manual administrative review).
    function placeAssetInEscrow(bytes32 assetId) public {
        require(registered[assetId], "ProofChain: asset not registered");
        assets[assetId].status = VerificationStatus.Escrowed;
        emit AssetEscrowed(assetId, msg.sender, block.timestamp);
    }

    /// @notice Resolves the current dispute and unlocks verification status for the asset.
    function resolveDispute(bytes32 assetId, bool accepted) public {
        require(registered[assetId], "ProofChain: asset not registered");
        require(disputeOpen[assetId], "ProofChain: no active dispute");

        disputes[assetId].active = false;
        disputes[assetId].accepted = accepted;
        disputes[assetId].resolvedAt = block.timestamp;
        disputeOpen[assetId] = false;
        assets[assetId].status = accepted ? VerificationStatus.Resolved : VerificationStatus.Rejected;

        emit DisputeResolved(assetId, accepted, block.timestamp);
    }

    /// @notice Alias for accepting a current dispute.
    function approveDispute(bytes32 assetId) public {
        resolveDispute(assetId, true);
    }

    /// @notice Alias for rejecting a current dispute.
    function rejectDispute(bytes32 assetId) public {
        resolveDispute(assetId, false);
    }

    /// @notice Returns the current dispute evidence for a registered asset if any exists.
    function getDispute(bytes32 assetId) public view returns (Dispute memory) {
        require(registered[assetId], "ProofChain: asset not registered");
        require(disputeOpen[assetId] || disputes[assetId].active || disputes[assetId].resolvedAt > 0, "ProofChain: no dispute found");
        return disputes[assetId];
    }

    /// @notice Returns whether the asset is currently in escrow due to an active dispute or administrative hold.
    function isInEscrow(bytes32 assetId) public view returns (bool) {
        require(registered[assetId], "ProofChain: asset not registered");
        return assets[assetId].status == VerificationStatus.Escrowed;
    }

    /// @notice Returns full on-chain record for an asset. Reverts if it doesn't exist.
    function verifyAsset(bytes32 assetId) external view returns (Asset memory) {
        require(registered[assetId], "ProofChain: asset not registered");
        return assets[assetId];
    }

    /// @notice Alias with an explicit name matching the product spec's "getAsset" requirement.
    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        require(registered[assetId], "ProofChain: asset not registered");
        return assets[assetId];
    }

    /// @notice Transfers ownership of an asset to a new wallet. Only the current owner may call this.
    function transferOwnership(bytes32 assetId, address newOwner) external onlyAssetOwner(assetId) {
        require(newOwner != address(0), "ProofChain: cannot transfer to zero address");
        require(newOwner != assets[assetId].owner, "ProofChain: newOwner is already the owner");

        address previousOwner = assets[assetId].owner;
        assets[assetId].owner = newOwner;
        ownershipHistory[assetId].push(newOwner);

        emit OwnershipTransferred(assetId, previousOwner, newOwner, block.timestamp);
    }

    /// @notice Returns the full chronological ownership trail for an asset.
    function getOwnershipHistory(bytes32 assetId) external view returns (address[] memory) {
        require(registered[assetId], "ProofChain: asset not registered");
        return ownershipHistory[assetId];
    }

    /// @notice Cheap existence check, useful for the backend before attempting a full read.
    function isRegistered(bytes32 assetId) external view returns (bool) {
        return registered[assetId];
    }
}
