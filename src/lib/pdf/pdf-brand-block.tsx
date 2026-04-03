import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const brandGreen = "#139d4b";

const styles = StyleSheet.create({
  logoWrap: {
    width: 200,
    height: 78,
    marginBottom: 12,
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  /* Prefer Buffer in Image src — data URIs can fail to render in some PDF builds */
  logo: {
    width: 200,
    height: 78,
    alignSelf: "flex-start",
  },
  wordmarkWrap: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: brandGreen,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  wordmark: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: brandGreen,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  wordmarkSub: {
    fontSize: 8,
    color: "#555555",
    marginTop: 3,
    letterSpacing: 0.2,
  },
});

type Props = {
  /** PNG bytes (preferred) or data URL string — see @react-pdf/types image Source */
  logoSource: Buffer | string | null;
};

export function PdfBrandBlock({ logoSource }: Props) {
  if (Buffer.isBuffer(logoSource) && logoSource.length > 0) {
    return (
      <View style={styles.logoWrap}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
        <Image src={logoSource} style={styles.logo} />
      </View>
    );
  }
  if (typeof logoSource === "string" && logoSource.length > 0) {
    return (
      <View style={styles.logoWrap}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
        <Image src={logoSource} style={styles.logo} />
      </View>
    );
  }

  return (
    <View style={styles.wordmarkWrap}>
      <Text style={styles.wordmark}>Handicaps Network Africa</Text>
      <Text style={styles.wordmarkSub}>Hardware inventory and lifecycle</Text>
    </View>
  );
}
