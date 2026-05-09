import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type InvoicePdfData = {
  number: string;
  issueDate: Date;
  clientName: string;
  service: string;
  serviceDate: Date;
  amount: number;
  method: string;
};

const logoPath = `${process.cwd()}/public/invoices/logoBEDS.png`;
const signaturePath = `${process.cwd()}/public/invoices/signature.png`;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingBottom: 42,
    paddingHorizontal: 44,
    paddingTop: 38,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLeft: {
    width: "34%",
  },
  logo: {
    height: 92,
    objectFit: "contain",
    width: 150,
  },
  siret: {
    fontSize: 10,
    marginTop: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    width: "62%",
  },
  orangeStrong: {
    color: "#9a4b17",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
  strongLine: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
  },
  contactBlock: {
    alignItems: "flex-end",
    marginTop: 14,
  },
  contactLine: {
    fontSize: 10.5,
    marginBottom: 3,
  },
  placeDate: {
    marginTop: 54,
  },
  placeDateLine: {
    fontSize: 11,
    marginBottom: 5,
  },
  invoiceTitleBlock: {
    alignItems: "center",
    marginTop: 54,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  invoiceSubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 74,
  },
  serviceText: {
    fontSize: 12,
    width: "68%",
  },
  amount: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    width: "28%",
  },
  paidBy: {
    fontSize: 11,
    marginTop: 12,
  },
  signatureBlock: {
    alignItems: "flex-end",
    marginTop: 28,
  },
  signatureImage: {
    height: 92,
    objectFit: "contain",
    width: 160,
  },
  footer: {
    bottom: 30,
    color: "#333333",
    fontSize: 9,
    left: 44,
    position: "absolute",
    right: 44,
  },
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const amountFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function formatAmount(amount: number) {
  return `${amountFormatter.format(amount)}€ TTC*`;
}

export function InvoicePdfDocument({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Document
      author="Julie Surrel"
      subject={`Facture ${invoice.number}`}
      title={`Facture ${invoice.number}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image alt="" src={logoPath} style={styles.logo} />
            <Text style={styles.siret}>N° SIRET 495 046 021 000 46</Text>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.orangeStrong}>
              Julie Surrel - Praticienne diplômée
            </Text>
            <Text style={styles.strongLine}>
              en médecine traditionnelle chinoise
            </Text>
            <Text style={styles.strongLine}>
              Acupuncture, Pharmacopée chinoise et locale,
            </Text>
            <Text style={styles.strongLine}>
              Bu Qi Tui Na & Diétothérapie
            </Text>

            <View style={styles.contactBlock}>
              <Text style={styles.contactLine}>EI Bien-être des sagesses</Text>
              <Text style={styles.contactLine}>253 rue Emmanuel Mauras</Text>
              <Text style={styles.contactLine}>43260 St Julien Chapteuil</Text>
              <Text style={styles.contactLine}>06 60 05 36 70</Text>
              <Text style={styles.contactLine}>
                bienetre.des.sagesses@gmail.com
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.placeDate}>
          <Text style={styles.placeDateLine}>A St Julien Chapteuil</Text>
          <Text style={styles.placeDateLine}>
            Le {formatDate(invoice.issueDate)}
          </Text>
        </View>

        <View style={styles.invoiceTitleBlock}>
          <Text style={styles.invoiceTitle}>
            Facture de soins N° {invoice.number}
          </Text>
          <Text style={styles.invoiceSubtitle}>
            Prestation de services à l&apos;attention de {invoice.clientName}
          </Text>
        </View>

        <View style={styles.serviceRow}>
          <Text style={styles.serviceText}>
            {invoice.service}, le {formatDate(invoice.serviceDate)}
          </Text>
          <Text style={styles.amount}>{formatAmount(invoice.amount)}</Text>
        </View>

        <Text style={styles.paidBy}>(payée par {invoice.method})</Text>

        <View style={styles.signatureBlock}>
          <Image alt="" src={signaturePath} style={styles.signatureImage} />
        </View>

        <Text style={styles.footer}>
          * TVA non applicable, article 293 B du code général des impôts
        </Text>
      </Page>
    </Document>
  );
}
