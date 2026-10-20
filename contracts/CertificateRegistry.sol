// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateRegistry
 * @author CertChain Team
 * @notice Tamper-proof certificate issuance and verification on the blockchain.
 * @dev Stores only cryptographic hashes and metadata — never personal data on-chain.
 *      Institutes are whitelisted by the contract owner. Each institute can issue
 *      and revoke its own certificates.
 */
contract CertificateRegistry is Ownable {
    // ─────────────────────────────────────────────
    //  Custom Errors
    // ─────────────────────────────────────────────
    error NotAnIssuer(address caller);
    error AlreadyAnIssuer(address issuer);
    error CertificateAlreadyExists(bytes32 certHash);
    error CertificateNotFound(bytes32 certHash);
    error NotTheCertificateIssuer(address caller, bytes32 certHash);
    error CertificateAlreadyRevoked(bytes32 certHash);

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────
    /**
     * @notice On-chain metadata for a single certificate.
     * @param certHash   SHA-256 hash of the original PDF bytes (keccak of the raw hash for storage).
     * @param issuer     Address of the issuing institute.
     * @param issuerName Human-readable name of the issuing institute.
     * @param ipfsCid    IPFS CID where the PDF is stored (optional, empty string if not uploaded).
     * @param issuedAt   Unix timestamp of issuance.
     * @param revoked    Whether this certificate has been revoked.
     * @param revokedAt  Unix timestamp of revocation (0 if not revoked).
     */
    struct Certificate {
        bytes32 certHash;
        address issuer;
        string  issuerName;
        string  ipfsCid;
        uint256 issuedAt;
        bool    revoked;
        uint256 revokedAt;
    }

    struct IssuerInfo {
        string  name;
        bool    active;
        uint256 addedAt;
    }

    // ─────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────
    mapping(bytes32 => Certificate)  private _certificates;
    mapping(address => IssuerInfo)   private _issuers;
    mapping(address => bytes32[])    private _issuerCerts;
    address[]                        private _issuerList;

    uint256 public totalCertificates;
    uint256 public totalIssuers;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────
    /// @notice Emitted when a new issuer is whitelisted.
    event IssuerAdded(address indexed issuer, string name, uint256 timestamp);
    /// @notice Emitted when an issuer is removed.
    event IssuerRemoved(address indexed issuer, uint256 timestamp);
    /// @notice Emitted when a certificate is issued.
    event CertificateIssued(
        bytes32 indexed certHash,
        address indexed issuer,
        string  ipfsCid,
        uint256 timestamp
    );
    /// @notice Emitted when a certificate is revoked.
    event CertificateRevoked(
        bytes32 indexed certHash,
        address indexed issuer,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────
    modifier onlyIssuer() {
        if (!_issuers[msg.sender].active) revert NotAnIssuer(msg.sender);
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  Admin Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Whitelist a new certificate issuer.
     * @param issuer  Address of the institute.
     * @param name    Human-readable institute name.
     */
    function addIssuer(address issuer, string calldata name) external onlyOwner {
        if (_issuers[issuer].active) revert AlreadyAnIssuer(issuer);
        _issuers[issuer] = IssuerInfo({ name: name, active: true, addedAt: block.timestamp });
        _issuerList.push(issuer);
        totalIssuers++;
        emit IssuerAdded(issuer, name, block.timestamp);
    }

    /**
     * @notice Remove a previously whitelisted issuer.
     * @param issuer  Address of the institute to remove.
     */
    function removeIssuer(address issuer) external onlyOwner {
        if (!_issuers[issuer].active) revert NotAnIssuer(issuer);
        _issuers[issuer].active = false;
        totalIssuers--;
        emit IssuerRemoved(issuer, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Issuer Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Issue a new certificate. Only callable by whitelisted issuers.
     * @param certHash  SHA-256 hash of the certificate PDF (as bytes32).
     * @param ipfsCid   IPFS CID of the PDF (can be empty string).
     */
    function issueCertificate(bytes32 certHash, string calldata ipfsCid)
        external
        onlyIssuer
    {
        if (_certificates[certHash].issuedAt != 0)
            revert CertificateAlreadyExists(certHash);

        _certificates[certHash] = Certificate({
            certHash:   certHash,
            issuer:     msg.sender,
            issuerName: _issuers[msg.sender].name,
            ipfsCid:    ipfsCid,
            issuedAt:   block.timestamp,
            revoked:    false,
            revokedAt:  0
        });

        _issuerCerts[msg.sender].push(certHash);
        totalCertificates++;

        emit CertificateIssued(certHash, msg.sender, ipfsCid, block.timestamp);
    }

    /**
     * @notice Revoke a previously issued certificate.
     * @dev Only the original issuer can revoke their own certificate.
     * @param certHash  Hash of the certificate to revoke.
     */
    function revokeCertificate(bytes32 certHash) external onlyIssuer {
        Certificate storage cert = _certificates[certHash];
        if (cert.issuedAt == 0) revert CertificateNotFound(certHash);
        if (cert.issuer != msg.sender) revert NotTheCertificateIssuer(msg.sender, certHash);
        if (cert.revoked) revert CertificateAlreadyRevoked(certHash);

        cert.revoked   = true;
        cert.revokedAt = block.timestamp;

        emit CertificateRevoked(certHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Verify a certificate by hash.
     * @param certHash  Hash to look up.
     * @return exists      Whether the certificate has been registered.
     * @return revoked     Whether it has been revoked.
     * @return issuerName  Name of the issuing institute.
     * @return issuer      Address of the issuing institute.
     * @return issuedAt    Timestamp of issuance.
     * @return revokedAt   Timestamp of revocation (0 if not revoked).
     * @return ipfsCid     IPFS CID of the original PDF.
     */
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (
            bool    exists,
            bool    revoked,
            string  memory issuerName,
            address issuer,
            uint256 issuedAt,
            uint256 revokedAt,
            string  memory ipfsCid
        )
    {
        Certificate storage cert = _certificates[certHash];
        if (cert.issuedAt == 0) {
            return (false, false, "", address(0), 0, 0, "");
        }
        return (
            true,
            cert.revoked,
            cert.issuerName,
            cert.issuer,
            cert.issuedAt,
            cert.revokedAt,
            cert.ipfsCid
        );
    }

    /**
     * @notice Get all certificate hashes issued by a given issuer.
     * @param issuer  Address to query.
     * @return Array of certificate hashes.
     */
    function getIssuerCertificates(address issuer)
        external
        view
        returns (bytes32[] memory)
    {
        return _issuerCerts[issuer];
    }

    /**
     * @notice Get full certificate data by hash.
     * @param certHash  Hash to look up.
     */
    function getCertificate(bytes32 certHash)
        external
        view
        returns (Certificate memory)
    {
        return _certificates[certHash];
    }

    /**
     * @notice Check whether an address is a whitelisted issuer.
     */
    function isIssuer(address addr) external view returns (bool) {
        return _issuers[addr].active;
    }

    /**
     * @notice Get issuer info.
     */
    function getIssuerInfo(address addr)
        external
        view
        returns (string memory name, bool active, uint256 addedAt)
    {
        IssuerInfo storage info = _issuers[addr];
        return (info.name, info.active, info.addedAt);
    }

    /**
     * @notice Return all issuer addresses ever added (including removed ones).
     */
    function getAllIssuers() external view returns (address[] memory) {
        return _issuerList;
    }
}
