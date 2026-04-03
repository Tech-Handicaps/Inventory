import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PdfBrandBlock } from "@/lib/pdf/pdf-brand-block";

export type PdfCatalogRow = {
  label: string;
  manufacturer: string;
  model: string;
  category: string;
  notes: string | null;
  updatedAt: string;
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
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: black,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eeeeee",
    paddingVertical: 4,
  },
  td: { fontSize: 6.5, color: black },
  labelCol: { width: "22%" },
  mfrCol: { width: "15%" },
  modelCol: { width: "15%" },
  catCol: { width: "13%" },
  notesCol: { width: "23%" },
  dateCol: { width: "12%" },
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
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function CatalogReportDocument({
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
  rows: PdfCatalogRow[];
}) {
  const rowChunks = chunk(rows, 26);
  const pagesNeeded = Math.max(1, rowChunks.length);

  return (
    <Document
      title={title}
      author="Handicaps Network Africa"
      subject="Device template catalog report"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} fixed />
        <PdfBrandBlock logoSource={logoSource} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>
          Generated {generatedAt} · Catalog presets only (not physical assets).
          Each row is identified by label, manufacturer, and model; internal
          database IDs are omitted for readability.
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

        <Text style={styles.sectionTitle}>Catalog entries</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.labelCol]}>Label</Text>
          <Text style={[styles.th, styles.mfrCol]}>Mfr</Text>
          <Text style={[styles.th, styles.modelCol]}>Model</Text>
          <Text style={[styles.th, styles.catCol]}>Category</Text>
          <Text style={[styles.th, styles.notesCol]}>Notes</Text>
          <Text style={[styles.th, styles.dateCol]}>Updated</Text>
        </View>
        {(rowChunks[0] ?? []).map((r, i) => (
          <View key={`r0-${i}`} style={styles.row}>
            <Text style={[styles.td, styles.labelCol]}>{r.label}</Text>
            <Text style={[styles.td, styles.mfrCol]}>{r.manufacturer}</Text>
            <Text style={[styles.td, styles.modelCol]}>{r.model}</Text>
            <Text style={[styles.td, styles.catCol]}>{r.category}</Text>
            <Text style={[styles.td, styles.notesCol]}>
              {r.notes?.trim() ? r.notes : "—"}
            </Text>
            <Text style={[styles.td, styles.dateCol]}>{r.updatedAt}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Handicaps Network Africa · Device template catalog · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>

      {rowChunks.slice(1).map((chunkRows, pageIdx) => (
        <Page key={`p-${pageIdx}`} size="A4" style={styles.page}>
          <View style={styles.headerBar} fixed />
          <Text style={styles.sectionTitle}>
            Catalog (continued) · {pageIdx + 2} / {pagesNeeded}
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.labelCol]}>Label</Text>
            <Text style={[styles.th, styles.mfrCol]}>Mfr</Text>
            <Text style={[styles.th, styles.modelCol]}>Model</Text>
            <Text style={[styles.th, styles.catCol]}>Category</Text>
            <Text style={[styles.th, styles.notesCol]}>Notes</Text>
            <Text style={[styles.th, styles.dateCol]}>Updated</Text>
          </View>
          {chunkRows.map((r, i) => (
            <View key={`r-${pageIdx}-${i}`} style={styles.row}>
              <Text style={[styles.td, styles.labelCol]}>{r.label}</Text>
              <Text style={[styles.td, styles.mfrCol]}>{r.manufacturer}</Text>
              <Text style={[styles.td, styles.modelCol]}>{r.model}</Text>
              <Text style={[styles.td, styles.catCol]}>{r.category}</Text>
              <Text style={[styles.td, styles.notesCol]}>
                {r.notes?.trim() ? r.notes : "—"}
              </Text>
              <Text style={[styles.td, styles.dateCol]}>{r.updatedAt}</Text>
            </View>
          ))}
          <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
              `Handicaps Network Africa · Device template catalog · Page ${pageNumber} of ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  );
}
