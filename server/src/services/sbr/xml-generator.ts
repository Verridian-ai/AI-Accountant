/**
 * SBR XML Generator
 *
 * Generates ATO-compliant SBR XML for BAS lodgement.
 */

import type { BASData, BusinessProfile } from './types.js';
import { SBR_NAMESPACES } from './types.js';
import { escapeXml, formatABN, centsToWholeNumber } from './helpers.js';

/**
 * Build the complete SBR XML document
 */
export function generateSBRXml(basData: BASData, profile: BusinessProfile): string {
  const lodgementDate = basData.lodgementDate || new Date().toISOString().slice(0, 10);
  const documentId = `BAS-${profile.abn}-${basData.financialYear}-Q${basData.quarter}`;

  // Calculate net amounts
  const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
  const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
  const totalFuelTaxCredits =
    (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
  const paygInstalment = basData.paygInstalment['5A'] || 0;
  const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ActivityStatement xmlns="${SBR_NAMESPACES.sbr}"
    xmlns:xsi="${SBR_NAMESPACES.xsi}"
    xmlns:common="${SBR_NAMESPACES.common}"
    xmlns:party="${SBR_NAMESPACES.party}">

  <!-- Document Header -->
  <DocumentHeader>
    <DocumentID>${escapeXml(documentId)}</DocumentID>
    <DocumentType>BAS</DocumentType>
    <LodgementDate>${lodgementDate}</LodgementDate>
    <SoftwareProduct>
      <Name>GoldLedger</Name>
      <Version>1.0.0</Version>
    </SoftwareProduct>
  </DocumentHeader>

  <!-- Party Details -->
  <Party>
    <ABN>${formatABN(profile.abn)}</ABN>
    <BusinessName>${escapeXml(profile.businessName)}</BusinessName>
    ${profile.tradingName ? `<TradingName>${escapeXml(profile.tradingName)}</TradingName>` : ''}
    <GSTRegistered>${profile.gstRegistered ? 'Y' : 'N'}</GSTRegistered>
    ${profile.gstBranch ? `<GSTBranch>${profile.gstBranch}</GSTBranch>` : ''}
    <AccountingBasis>${profile.accountingBasis.toUpperCase()}</AccountingBasis>
    <Contact>
      <Name>${escapeXml(profile.contactName)}</Name>
      <Phone>${escapeXml(profile.contactPhone)}</Phone>
      <Email>${escapeXml(profile.contactEmail)}</Email>
    </Contact>
    <PostalAddress>
      <Line1>${escapeXml(profile.postalAddress.line1)}</Line1>
      ${profile.postalAddress.line2 ? `<Line2>${escapeXml(profile.postalAddress.line2)}</Line2>` : ''}
      <Suburb>${escapeXml(profile.postalAddress.suburb)}</Suburb>
      <State>${profile.postalAddress.state}</State>
      <Postcode>${profile.postalAddress.postcode}</Postcode>
      <Country>AU</Country>
    </PostalAddress>
  </Party>

  <!-- Period Details -->
  <Period>
    <FinancialYear>${basData.financialYear}</FinancialYear>
    <Quarter>${basData.quarter}</Quarter>
    <StartDate>${basData.periodStart}</StartDate>
    <EndDate>${basData.periodEnd}</EndDate>
  </Period>

  <!-- GST Section -->
  <GSTSection>
    <!-- Sales -->
    <Sales>
      <G1>${centsToWholeNumber(basData.gstLabels.G1)}</G1>
      <G2>${centsToWholeNumber(basData.gstLabels.G2)}</G2>
      <G3>${centsToWholeNumber(basData.gstLabels.G3)}</G3>
      ${basData.gstLabels.G4 !== undefined ? `<G4>${centsToWholeNumber(basData.gstLabels.G4)}</G4>` : ''}
      ${basData.gstLabels.G7 !== undefined ? `<G7>${centsToWholeNumber(basData.gstLabels.G7)}</G7>` : ''}
    </Sales>

    <!-- Purchases -->
    <Purchases>
      <G10>${centsToWholeNumber(basData.gstLabels.G10)}</G10>
      <G11>${centsToWholeNumber(basData.gstLabels.G11)}</G11>
      ${basData.gstLabels.G13 !== undefined ? `<G13>${centsToWholeNumber(basData.gstLabels.G13)}</G13>` : ''}
      ${basData.gstLabels.G14 !== undefined ? `<G14>${centsToWholeNumber(basData.gstLabels.G14)}</G14>` : ''}
      ${basData.gstLabels.G15 !== undefined ? `<G15>${centsToWholeNumber(basData.gstLabels.G15)}</G15>` : ''}
      ${basData.gstLabels.G17 !== undefined ? `<G17>${centsToWholeNumber(basData.gstLabels.G17)}</G17>` : ''}
    </Purchases>

    <!-- GST Summary -->
    <GSTSummary>
      <Label1A>${centsToWholeNumber(basData.gstSummary['1A'])}</Label1A>
      <Label1B>${centsToWholeNumber(basData.gstSummary['1B'])}</Label1B>
      ${basData.gstSummary['1C'] !== undefined ? `<Label1C>${centsToWholeNumber(basData.gstSummary['1C'])}</Label1C>` : ''}
      ${basData.gstSummary['1D'] !== undefined ? `<Label1D>${centsToWholeNumber(basData.gstSummary['1D'])}</Label1D>` : ''}
      ${basData.gstSummary['1E'] !== undefined ? `<Label1E>${centsToWholeNumber(basData.gstSummary['1E'])}</Label1E>` : ''}
      ${basData.gstSummary['1F'] !== undefined ? `<Label1F>${centsToWholeNumber(basData.gstSummary['1F'])}</Label1F>` : ''}
      <NetGST>${centsToWholeNumber(netGst)}</NetGST>
    </GSTSummary>
  </GSTSection>

  <!-- PAYG Withholding Section -->
  <PAYGWithholdingSection>
    <W1>${centsToWholeNumber(basData.paygWithholding.W1)}</W1>
    <W2>${centsToWholeNumber(basData.paygWithholding.W2)}</W2>
    ${basData.paygWithholding.W3 !== undefined ? `<W3>${centsToWholeNumber(basData.paygWithholding.W3)}</W3>` : ''}
    <W4>${centsToWholeNumber(totalPaygWithholding)}</W4>
    ${basData.paygWithholding.W5 !== undefined ? `<W5>${centsToWholeNumber(basData.paygWithholding.W5)}</W5>` : ''}
  </PAYGWithholdingSection>

  <!-- PAYG Instalment Section -->
  <PAYGInstalmentSection>
    ${basData.paygInstalment['5A'] !== undefined ? `<Label5A>${centsToWholeNumber(basData.paygInstalment['5A'])}</Label5A>` : ''}
    ${basData.paygInstalment['5B'] !== undefined ? `<Label5B>${centsToWholeNumber(basData.paygInstalment['5B'])}</Label5B>` : ''}
    ${basData.paygInstalment.T1 !== undefined ? `<T1>${centsToWholeNumber(basData.paygInstalment.T1)}</T1>` : ''}
    ${basData.paygInstalment.T2 !== undefined ? `<T2>${basData.paygInstalment.T2}</T2>` : ''}
    ${basData.paygInstalment.T7 !== undefined ? `<T7>${basData.paygInstalment.T7}</T7>` : ''}
    ${basData.paygInstalment.T8 !== undefined ? `<T8>${centsToWholeNumber(basData.paygInstalment.T8)}</T8>` : ''}
  </PAYGInstalmentSection>

  <!-- Fuel Tax Credits Section -->
  ${
    basData.fuelTaxCredits
      ? `
  <FuelTaxCreditsSection>
    ${basData.fuelTaxCredits['7A'] !== undefined ? `<Label7A>${centsToWholeNumber(basData.fuelTaxCredits['7A'])}</Label7A>` : ''}
    ${basData.fuelTaxCredits['7B'] !== undefined ? `<Label7B>${centsToWholeNumber(basData.fuelTaxCredits['7B'])}</Label7B>` : ''}
    <Label7C>${centsToWholeNumber(basData.fuelTaxCredits['7C'])}</Label7C>
    <Label7D>${centsToWholeNumber(basData.fuelTaxCredits['7D'])}</Label7D>
    <TotalFuelTaxCredits>${centsToWholeNumber(totalFuelTaxCredits)}</TotalFuelTaxCredits>
  </FuelTaxCreditsSection>
  `
      : ''
  }

  <!-- Deferred GST Section -->
  ${
    basData.deferredGst
      ? `
  <DeferredGSTSection>
    <Label7>${centsToWholeNumber(basData.deferredGst['7'])}</Label7>
  </DeferredGSTSection>
  `
      : ''
  }

  <!-- FBT Instalment Section -->
  ${
    basData.fbtInstalment
      ? `
  <FBTInstalmentSection>
    ${basData.fbtInstalment.F1 !== undefined ? `<F1>${centsToWholeNumber(basData.fbtInstalment.F1)}</F1>` : ''}
    ${basData.fbtInstalment.F2 !== undefined ? `<F2>${centsToWholeNumber(basData.fbtInstalment.F2)}</F2>` : ''}
    ${basData.fbtInstalment.F3 !== undefined ? `<F3>${centsToWholeNumber(basData.fbtInstalment.F3)}</F3>` : ''}
    ${basData.fbtInstalment.F4 !== undefined ? `<F4>${basData.fbtInstalment.F4}</F4>` : ''}
  </FBTInstalmentSection>
  `
      : ''
  }

  <!-- Summary -->
  <Summary>
    <NetGST>${centsToWholeNumber(netGst)}</NetGST>
    <PAYGWithholding>${centsToWholeNumber(totalPaygWithholding)}</PAYGWithholding>
    <PAYGInstalment>${centsToWholeNumber(paygInstalment)}</PAYGInstalment>
    <FuelTaxCredits>${centsToWholeNumber(totalFuelTaxCredits)}</FuelTaxCredits>
    <TotalPayable>${centsToWholeNumber(totalPayable)}</TotalPayable>
    <PaymentDirection>${totalPayable >= 0 ? 'PAYABLE' : 'REFUND'}</PaymentDirection>
  </Summary>

  <!-- Declaration -->
  <Declaration>
    <DeclarationText>I declare that the information in this activity statement is true and correct.</DeclarationText>
    <DeclarationDate>${lodgementDate}</DeclarationDate>
  </Declaration>

</ActivityStatement>`;

  return xml;
}
