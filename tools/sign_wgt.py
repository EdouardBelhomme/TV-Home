"""Package and sign a Tizen web app (.wgt) without Tizen Studio.

Produces the two W3C widget signatures Tizen expects (author-signature.xml and
signature1.xml), using an author certificate issued by the public "Tizen Developers CA"
and the public Tizen distributor certificate, both shipped in Tizen's certificate-generator.

  sign_wgt.py make-author --ca-dir DIR --out DIR [--name NAME]
  sign_wgt.py sign SRC_DIR OUT.wgt --certs DIR
  sign_wgt.py verify FILE.wgt
"""
import argparse
import base64
import datetime
import hashlib
import os
import sys
import urllib.parse
import zipfile

sys.path.insert(0, os.path.expanduser("~/tvctl-lib"))
from cryptography import x509  # noqa: E402
from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import padding, rsa  # noqa: E402
from cryptography.hazmat.primitives.serialization import pkcs12  # noqa: E402
from cryptography.x509.oid import NameOID  # noqa: E402
from lxml import etree  # noqa: E402

DSIG = "http://www.w3.org/2000/09/xmldsig#"
DISTRIBUTOR_P12_PASSWORD = b"tizenpkcs12passfordsigner"  # public, shipped with Tizen Studio
SIG_FILES = ("author-signature.xml", "signature1.xml")


def developer_ca_password(ca_dir):
    """The CA key password ships next to it, in certificate-generator/certificates/developer/conf.ini."""
    for line in open(os.path.join(ca_dir, "conf.ini")):
        if line.startswith("PASSWD_OF_ISSUER_FOR_DEV="):
            return line.split("=", 1)[1].strip().encode()
    raise SystemExit("conf.ini: PASSWD_OF_ISSUER_FOR_DEV not found")


def b64(data, wrap=76):
    s = base64.b64encode(data).decode()
    return "\n".join(s[i:i + wrap] for i in range(0, len(s), wrap))


def digest(data):
    return b64(hashlib.sha512(data).digest())


def reference(uri, digest_value, transform=None):
    t = ""
    if transform:
        t = '<Transforms>\n<Transform Algorithm="%s"></Transform>\n</Transforms>\n' % transform
    return ('<Reference URI="%s">\n%s<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha512"></DigestMethod>\n'
            '<DigestValue>%s</DigestValue>\n</Reference>\n') % (uri, t, digest_value)


def prop_object(sig_id, role):
    return ('<Object Id="prop"><SignatureProperties xmlns:dsp="http://www.w3.org/2009/xmldsig-properties">'
            '<SignatureProperty Id="profile" Target="#{id}"><dsp:Profile URI="http://www.w3.org/ns/widgets-digsig#profile"></dsp:Profile></SignatureProperty>'
            '<SignatureProperty Id="role" Target="#{id}"><dsp:Role URI="http://www.w3.org/ns/widgets-digsig#role-{role}"></dsp:Role></SignatureProperty>'
            '<SignatureProperty Id="identifier" Target="#{id}"><dsp:Identifier></dsp:Identifier></SignatureProperty>'
            '</SignatureProperties></Object>').format(id=sig_id, role=role)


def c14n(element, exclusive):
    return etree.tostring(element, method="c14n", exclusive=exclusive, with_comments=False)


def prop_digest(sig_id, role):
    # Canonical form of the Object as Tizen's signer computes it: the serialized element with the
    # inherited default xmldsig namespace declared on it (checked against a Tizen Studio-signed package).
    canonical = prop_object(sig_id, role).replace("<Object ", '<Object xmlns="%s" ' % DSIG, 1)
    return digest(canonical.encode())


def build_signature(files, sig_id, role, key, chain):
    """files: list of (zip name, bytes) in the order they are referenced."""
    refs = "".join(reference(urllib.parse.quote(name, safe=""), digest(data)) for name, data in files)
    refs += reference("#prop", prop_digest(sig_id, role), "http://www.w3.org/2006/12/xml-c14n11")
    signed_info = ('<SignedInfo>\n<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>\n'
                   '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha512"></SignatureMethod>\n%s</SignedInfo>') % refs
    si = etree.fromstring('<Signature xmlns="%s" Id="%s">%s</Signature>' % (DSIG, sig_id, signed_info)).find("{%s}SignedInfo" % DSIG)
    value = key.sign(c14n(si, exclusive=True), padding.PKCS1v15(), hashes.SHA512())
    certs = "".join("<X509Certificate>\n%s\n</X509Certificate>\n" % b64(c.public_bytes(serialization.Encoding.DER)) for c in chain)
    return ('<Signature xmlns="%s" Id="%s">\n%s\n<SignatureValue>\n%s\n</SignatureValue>\n<KeyInfo>\n<X509Data>\n%s</X509Data>\n</KeyInfo>\n%s\n</Signature>'
            % (DSIG, sig_id, signed_info, b64(value), certs, prop_object(sig_id, role))).encode()


def load_p12(path, password):
    key, cert, extra = pkcs12.load_key_and_certificates(open(path, "rb").read(), password)
    return key, [cert] + list(extra or [])


def cmd_make_author(args):
    ca_bytes = open(os.path.join(args.ca_dir, "tizen-developer-ca.cer"), "rb").read()
    # The .cer is an "openssl x509 -text" dump followed by the PEM block.
    pem_start = ca_bytes.find(b"-----BEGIN CERTIFICATE-----")
    ca_cert = x509.load_pem_x509_certificate(ca_bytes[pem_start:]) if pem_start >= 0 else x509.load_der_x509_certificate(ca_bytes)
    ca_key = serialization.load_pem_private_key(open(os.path.join(args.ca_dir, "tizen-developer-ca-privatekey.pem"), "rb").read(),
                                                developer_ca_password(args.ca_dir))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder()
            .subject_name(x509.Name([x509.NameAttribute(NameOID.COUNTRY_NAME, "FR"), x509.NameAttribute(NameOID.COMMON_NAME, args.name)]))
            .issuer_name(ca_cert.subject)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(ca_cert.not_valid_after_utc)  # cannot outlive the issuing CA
            .sign(ca_key, hashes.SHA512()))
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "author.p12"), "wb") as f:
        f.write(pkcs12.serialize_key_and_certificates(b"author", key, cert, [ca_cert], serialization.NoEncryption()))
    print("author certificate valid until", cert.not_valid_after_utc.date())


def cmd_sign(args):
    files = []
    for root, _, names in os.walk(args.src):
        for n in names:
            rel = os.path.relpath(os.path.join(root, n), args.src).replace(os.sep, "/")
            if rel not in SIG_FILES:
                files.append((rel, open(os.path.join(root, n), "rb").read()))
    files.sort(key=lambda f: f[0])
    a_key, a_chain = load_p12(os.path.join(args.certs, "author.p12"), None)
    d_key, d_chain = load_p12(os.path.join(args.certs, "tizen-distributor-signer.p12"), DISTRIBUTOR_P12_PASSWORD)
    author = build_signature(files, "AuthorSignature", "author", a_key, a_chain)
    distributor = build_signature([("author-signature.xml", author)] + files, "DistributorSignature", "distributor", d_key, d_chain)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("author-signature.xml", author)
        for name, data in files:
            z.writestr(name, data)
        z.writestr("signature1.xml", distributor)
    print("signed", args.out, "(%d files)" % len(files))


def cmd_verify(args):
    """Recomputes every digest and checks both RSA signatures."""
    z = zipfile.ZipFile(args.wgt)
    ok = True
    for sig_name in SIG_FILES:
        root = etree.fromstring(z.read(sig_name))
        ns = {"d": DSIG}
        sig_id = root.get("Id")
        role = "author" if sig_id == "AuthorSignature" else "distributor"
        for ref in root.findall("d:SignedInfo/d:Reference", ns):
            uri = ref.get("URI")
            want = "".join(ref.find("d:DigestValue", ns).text.split())
            got = prop_digest(sig_id, role) if uri == "#prop" else digest(z.read(urllib.parse.unquote(uri)))
            if "".join(got.split()) != want:
                ok = False
                print("  digest mismatch:", sig_name, uri)
        cert = x509.load_der_x509_certificate(base64.b64decode("".join(root.find("d:KeyInfo/d:X509Data/d:X509Certificate", ns).text.split())))
        value = base64.b64decode("".join(root.find("d:SignatureValue", ns).text.split()))
        try:
            cert.public_key().verify(value, c14n(root.find("d:SignedInfo", ns), exclusive=True), padding.PKCS1v15(), hashes.SHA512())
            print("  %s: signature OK (%s)" % (sig_name, cert.subject.rfc4514_string()))
        except Exception as e:  # noqa: BLE001
            ok = False
            print("  %s: signature INVALID %r" % (sig_name, e))
    print("VALID" if ok else "INVALID")
    return 0 if ok else 1


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("make-author")
    m.add_argument("--ca-dir", required=True)
    m.add_argument("--out", required=True)
    m.add_argument("--name", default="TV-Home")
    s = sub.add_parser("sign")
    s.add_argument("src")
    s.add_argument("out")
    s.add_argument("--certs", required=True)
    v = sub.add_parser("verify")
    v.add_argument("wgt")
    args = p.parse_args()
    return {"make-author": cmd_make_author, "sign": cmd_sign, "verify": cmd_verify}[args.cmd](args) or 0


if __name__ == "__main__":
    sys.exit(main())
