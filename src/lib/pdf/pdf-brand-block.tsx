import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const brandGreen = "#139d4b";

const styles = StyleSheet.create({
  logo: {
    width: 180,
    height: 52,
    objectFit: "contain",
    marginBottom: 14,
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

/**
 * Logo from `public/brand/hna-logo.png` when present; otherwise a typed wordmark
 * so PDFs always show organisation branding.
 */
export function PdfBrandBlock({ logoDataUri }: { logoDataUri: string | null }) {
  if (logoDataUri) {
    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
        <Image src={logoDataUri} style={styles.logo} />
      </>
    );
  }
  return (
    <View style={styles.wordmarkWrap}>
      <Text style={styles.wordmark}>Handicaps Network Africa</Text>
      <Text style={styles.wordmarkSub}>Hardware inventory and lifecycle</Text>
    </View>
  );
}
