import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './format';

export interface BatchReceiptData {
    receiptNo: string;
    payerName: string;
    payerType: 'dealer' | 'reference' | string;
    totalAmount: number;
    paymentDate: string | Date;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    payments?: Array<{
        id?: string;
        amount: number;
        paidAmount?: number | null;
        dueDate: string | Date;
        status: string;
        notes?: string | null;
        customer?: {
            name: string;
            phone?: string | null;
        };
        policy?: {
            policyNumber: string;
            vehicleNumber?: string | null;
            company?: {
                name: string;
            };
        };
    }>;
}

export const generateBatchReceiptPdf = (batch: BatchReceiptData): void => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // 1. Header Banner
        doc.setFillColor(30, 58, 138); // Dark Navy Blue
        doc.rect(0, 0, pageWidth, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('BATCH PAYMENT RECEIPT', 14, 14);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Receipt No: ${batch.receiptNo}`, 14, 22);
        doc.text(`Date: ${formatDate(batch.paymentDate)}`, pageWidth - 14, 22, { align: 'right' });

        // 2. Payer & Payment Details Cards
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Payer Information:', 14, 38);
        doc.text('Payment Summary:', pageWidth / 2 + 10, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Name: ${batch.payerName} (${batch.payerType === 'dealer' ? 'Dealer' : 'Reference'})`, 14, 45);
        doc.text(`Payment Mode: ${(batch.paymentMethod || 'Cash').toUpperCase()}`, 14, 51);
        if (batch.referenceNumber) {
            doc.text(`Ref / UTR: ${batch.referenceNumber}`, 14, 57);
        }

        doc.setFont('helvetica', 'bold');
        doc.text(`Total Received: Rs. ${batch.totalAmount.toLocaleString('en-IN')}`, pageWidth / 2 + 10, 45);
        doc.setFont('helvetica', 'normal');
        doc.text(`Policies Settled: ${batch.payments?.length || 0}`, pageWidth / 2 + 10, 51);
        if (batch.notes) {
            doc.text(`Notes: ${batch.notes}`, pageWidth / 2 + 10, 57);
        }

        // 3. Divider
        doc.setDrawColor(229, 231, 235);
        doc.line(14, 63, pageWidth - 14, 63);

        // 4. Table of settled policies
        const tableBody = (batch.payments || []).map((p, idx) => {
            // Extract allocated amount from notes if available: "Batch #... (+₹500)"
            let allocDisplay = p.paidAmount ? `Rs. ${p.paidAmount.toLocaleString('en-IN')}` : `Rs. ${p.amount.toLocaleString('en-IN')}`;
            if (p.notes) {
                const match = p.notes.match(/\(\+₹([0-9.]+)\)/);
                if (match && match[1]) {
                    allocDisplay = `Rs. ${parseFloat(match[1]).toLocaleString('en-IN')}`;
                }
            }

            return [
                idx + 1,
                p.customer?.name || '—',
                `${p.policy?.policyNumber || '—'}${p.policy?.vehicleNumber ? ` (${p.policy.vehicleNumber})` : ''}`,
                p.policy?.company?.name || '—',
                formatDate(p.dueDate),
                `Rs. ${p.amount.toLocaleString('en-IN')}`,
                allocDisplay,
                p.status.toUpperCase() === 'PAID' ? 'CLEARED' : p.status.toUpperCase(),
            ];
        });

        autoTable(doc, {
            startY: 68,
            margin: { left: 14, right: 14 },
            head: [['#', 'Customer', 'Policy / Vehicle', 'Insurer', 'Due Date', 'Due Amount', 'Paid in Batch', 'Status']],
            body: tableBody,
            foot: [[
                { content: 'Total Received & Allocated:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `Rs. ${batch.totalAmount.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } },
                { content: '' }
            ]],
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2.5 },
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 180;
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('This is a computer generated receipt. Thank you for your business.', 14, finalY + 15);

        const safePayerName = (batch.payerName || 'Payer').replace(/\s+/g, '_');
        doc.save(`Receipt_${batch.receiptNo}_${safePayerName}.pdf`);
    } catch (err) {
        console.error('Failed to generate batch receipt PDF:', err);
        throw new Error('Could not generate receipt PDF');
    }
};
