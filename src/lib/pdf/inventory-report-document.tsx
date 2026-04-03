import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PdfBrandBlock } from "@/lib/pdf/pdf-brand-block";

export type PdfAssetRow = {
  assetName: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  statusLabel: string;
  dateUpdated: string;
};

const brandGreen = "#139d4b";
const black = "#111111";
const muted = "#555555";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: black,
  },
  headerBar: {
    height: 4,
    backgroundColor: brandGreen,
    marginBottom: 16,
    marginHorizontal: -40,
    marginTop: -36,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 10,
    color: muted,
    marginBottom: 12,
  },
  meta: {
    fontSize: 8,
    color: muted,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 8,
    color: brandGreen,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  summaryCell: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#dddddd",
    padding: 8,
    backgroundColor: "#f9faf9",
  },
  summaryLabel: { fontSize: 8, color: muted, marginBottom: 4 },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandGreen,
    paddingBottom: 6,
    marginBottom: 4,
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: black,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eeeeee",
    paddingVertical: 5,
  },
  td: { fontSize: 7, color: black },
  col1: { width: "18%" },
  col2: { width: "11%" },
  col3: { width: "13%" },
  col4: { width: "11%" },
  col5: { width: "14%" },
  col6: { width: "14%" },
  col7: { width: "19%" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: muted,
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    paddingTop: 8,
  },
  pageNum: {
    fontSize: 7,
    color: muted,
    textAlign: "right",
    marginTop: 4,
  },
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function InventoryReportDocument({
  title,
  subtitle,
  generatedAt,
  logoSource,
  summaryRows,
  rows,
}: {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  summaryRows: { label: string; value: string }[];
  rows: PdfAssetRow[];
}) {
  const rowChunks = chunk(rows, 24);
  const pagesNeeded = Math.max(1, rowChunks.length);

  return (
    <Document
      title={title}
      author="Handicaps Network Africa"
      subject="Hardware inventory report"
    >
      {/* First page: branding + summary + first chunk of rows */}
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} fixed />
        <PdfBrandBlock logoSource={logoSource} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>
          Generated {generatedAt} · For stakeholder & accounting use
        </Text>

        {summaryRows.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryGrid}>
              {summaryRows.map((s) => (
                <View key={s.label} style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>{s.label}</Text>
                  <Text style={styles.summaryValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Detail</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.col1]}>Asset</Text>
          <Text style={[styles.th, styles.col2]}>Category</Text>
          <Text style={[styles.th, styles.col3]}>Mfr</Text>
          <Text style={[styles.th, styles.col4]}>Model</Text>
          <Text style={[styles.th, styles.col5]}>Serial</Text>
          <Text style={[styles.th, styles.col6]}>Status</Text>
          <Text style={[styles.th, styles.col7]}>Updated</Text>
        </View>
        {(rowChunks[0] ?? []).map((r, i) => (
          <View key={`r0-${i}`} style={styles.row}>
            <Text style={[styles.td, styles.col1]}>{r.assetName}</Text>
            <Text style={[styles.td, styles.col2]}>{r.category}</Text>
            <Text style={[styles.td, styles.col3]}>
              {r.manufacturer ?? "—"}
            </Text>
            <Text style={[styles.td, styles.col4]}>{r.model ?? "—"}</Text>
            <Text style={[styles.td, styles.col5]}>{r.serialNumber ?? "—"}</Text>
            <Text style={[styles.td, styles.col6]}>{r.statusLabel}</Text>
            <Text style={[styles.td, styles.col7]}>{r.dateUpdated}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Handicaps Network Africa · Hardware inventory · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>

      {/* Continuation pages */}
      {rowChunks.slice(1).map((chunkRows, pageIdx) => (
        <Page key={`p-${pageIdx}`} size="A4" style={styles.page}>
          <View style={styles.headerBar} fixed />
          <Text style={styles.sectionTitle}>
            Detail (continued) · {pageIdx + 2} / {pagesNeeded}
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.col1]}>Asset</Text>
            <Text style={[styles.th, styles.col2]}>Category</Text>
            <Text style={[styles.th, styles.col3]}>Mfr</Text>
            <Text style={[styles.th, styles.col4]}>Model</Text>
            <Text style={[styles.th, styles.col5]}>Serial</Text>
            <Text style={[styles.th, styles.col6]}>Status</Text>
            <Text style={[styles.th, styles.col7]}>Updated</Text>
          </View>
          {chunkRows.map((r, i) => (
            <View key={`r-${pageIdx}-${i}`} style={styles.row}>
              <Text style={[styles.td, styles.col1]}>{r.assetName}</Text>
              <Text style={[styles.td, styles.col2]}>{r.category}</Text>
              <Text style={[styles.td, styles.col3]}>
                {r.manufacturer ?? "—"}
              </Text>
              <Text style={[styles.td, styles.col4]}>{r.model ?? "—"}</Text>
              <Text style={[styles.td, styles.col5]}>
                {r.serialNumber ?? "—"}
              </Text>
              <Text style={[styles.td, styles.col6]}>{r.statusLabel}</Text>
              <Text style={[styles.td, styles.col7]}>{r.dateUpdated}</Text>
            </View>
          ))}
          <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
              `Handicaps Network Africa · Hardware inventory · Page ${pageNumber} of ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  );
}
