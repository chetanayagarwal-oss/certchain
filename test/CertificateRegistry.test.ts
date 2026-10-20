import { expect } from "chai";
import { ethers } from "hardhat";
import { CertificateRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CertificateRegistry", function () {
  let registry: CertificateRegistry;
  let owner: HardhatEthersSigner;
  let issuer1: HardhatEthersSigner;
  let issuer2: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const ISSUER_NAME = "MIT";
  const SAMPLE_HASH = ethers.encodeBytes32String("sample-cert-hash-001");
  const SAMPLE_CID  = "QmSampleIPFSCid";

  beforeEach(async () => {
    [owner, issuer1, issuer2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    registry = await Factory.deploy() as unknown as CertificateRegistry;
    await registry.waitForDeployment();
  });

  // ─── Issuer Management ───────────────────────────────────────────────────
  describe("Issuer Management", () => {
    it("owner can add an issuer", async () => {
      await expect(registry.addIssuer(issuer1.address, ISSUER_NAME))
        .to.emit(registry, "IssuerAdded")
        .withArgs(issuer1.address, ISSUER_NAME, await latestTimestamp());

      expect(await registry.isIssuer(issuer1.address)).to.be.true;
      expect(await registry.totalIssuers()).to.equal(1n);
    });

    it("reverts when adding duplicate issuer", async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
      await expect(registry.addIssuer(issuer1.address, ISSUER_NAME))
        .to.be.revertedWithCustomError(registry, "AlreadyAnIssuer")
        .withArgs(issuer1.address);
    });

    it("owner can remove an issuer", async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
      await expect(registry.removeIssuer(issuer1.address))
        .to.emit(registry, "IssuerRemoved");
      expect(await registry.isIssuer(issuer1.address)).to.be.false;
      expect(await registry.totalIssuers()).to.equal(0n);
    });

    it("non-owner cannot add issuer", async () => {
      await expect(
        registry.connect(stranger).addIssuer(issuer1.address, ISSUER_NAME)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("non-owner cannot remove issuer", async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
      await expect(
        registry.connect(stranger).removeIssuer(issuer1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Certificate Issuance ─────────────────────────────────────────────────
  describe("Certificate Issuance", () => {
    beforeEach(async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
    });

    it("whitelisted issuer can issue a certificate", async () => {
      await expect(
        registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID)
      )
        .to.emit(registry, "CertificateIssued")
        .withArgs(SAMPLE_HASH, issuer1.address, SAMPLE_CID, await latestTimestamp());

      expect(await registry.totalCertificates()).to.equal(1n);
    });

    it("reverts on duplicate hash", async () => {
      await registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID);
      await expect(
        registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID)
      )
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyExists")
        .withArgs(SAMPLE_HASH);
    });

    it("unauthorized address cannot issue certificate", async () => {
      await expect(
        registry.connect(stranger).issueCertificate(SAMPLE_HASH, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "NotAnIssuer");
    });

    it("removed issuer cannot issue certificates", async () => {
      await registry.removeIssuer(issuer1.address);
      await expect(
        registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "NotAnIssuer");
    });
  });

  // ─── Certificate Verification ─────────────────────────────────────────────
  describe("Certificate Verification", () => {
    beforeEach(async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
      await registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID);
    });

    it("verifies a valid certificate", async () => {
      const [exists, revoked, issuerName, issuer, issuedAt, revokedAt, ipfsCid] =
        await registry.verifyCertificate(SAMPLE_HASH);

      expect(exists).to.be.true;
      expect(revoked).to.be.false;
      expect(issuerName).to.equal(ISSUER_NAME);
      expect(issuer).to.equal(issuer1.address);
      expect(issuedAt).to.be.gt(0n);
      expect(revokedAt).to.equal(0n);
      expect(ipfsCid).to.equal(SAMPLE_CID);
    });

    it("returns exists=false for a nonexistent certificate", async () => {
      const bogusHash = ethers.encodeBytes32String("nonexistent");
      const [exists] = await registry.verifyCertificate(bogusHash);
      expect(exists).to.be.false;
    });

    it("getIssuerCertificates returns hashes for a given issuer", async () => {
      const certs = await registry.getIssuerCertificates(issuer1.address);
      expect(certs).to.have.lengthOf(1);
      expect(certs[0]).to.equal(SAMPLE_HASH);
    });
  });

  // ─── Certificate Revocation ───────────────────────────────────────────────
  describe("Certificate Revocation", () => {
    beforeEach(async () => {
      await registry.addIssuer(issuer1.address, ISSUER_NAME);
      await registry.addIssuer(issuer2.address, "Stanford");
      await registry.connect(issuer1).issueCertificate(SAMPLE_HASH, SAMPLE_CID);
    });

    it("original issuer can revoke their certificate", async () => {
      await expect(registry.connect(issuer1).revokeCertificate(SAMPLE_HASH))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(SAMPLE_HASH, issuer1.address, await latestTimestamp());

      const [exists, revoked, , , , revokedAt] =
        await registry.verifyCertificate(SAMPLE_HASH);
      expect(exists).to.be.true;
      expect(revoked).to.be.true;
      expect(revokedAt).to.be.gt(0n);
    });

    it("different issuer cannot revoke another issuer's certificate", async () => {
      await expect(
        registry.connect(issuer2).revokeCertificate(SAMPLE_HASH)
      ).to.be.revertedWithCustomError(registry, "NotTheCertificateIssuer");
    });

    it("cannot revoke a nonexistent certificate", async () => {
      const bogusHash = ethers.encodeBytes32String("ghost");
      await expect(
        registry.connect(issuer1).revokeCertificate(bogusHash)
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });

    it("cannot revoke an already-revoked certificate", async () => {
      await registry.connect(issuer1).revokeCertificate(SAMPLE_HASH);
      await expect(
        registry.connect(issuer1).revokeCertificate(SAMPLE_HASH)
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked");
    });

    it("revoked certificate shows correct state", async () => {
      await registry.connect(issuer1).revokeCertificate(SAMPLE_HASH);
      const [exists, revoked] = await registry.verifyCertificate(SAMPLE_HASH);
      expect(exists).to.be.true;
      expect(revoked).to.be.true;
    });
  });
});

async function latestTimestamp(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp + 1);
}
