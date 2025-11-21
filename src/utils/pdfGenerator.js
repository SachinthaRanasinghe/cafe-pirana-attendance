// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';

export const generateMonthlyReport = async (staffAvailabilities, month) => {
  const doc = new jsPDF();
  
  // Parse month
  const [year, monthNum] = month.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[parseInt(monthNum) - 1];
  const currentDate = new Date().toLocaleDateString();
  
  // Set initial positions
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  const sectionGap = 10;

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add a section header
  const addSectionHeader = (text, fontSize = 14) => {
    checkPageBreak(20);
    doc.setFontSize(fontSize);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40);
    doc.text(text, margin, yPosition);
    yPosition += lineHeight + 2;
    doc.setFont(undefined, 'normal');
    return yPosition;
  };

  // Helper function to add a line of text
  const addText = (text, fontSize = 10, isBold = false) => {
    checkPageBreak(lineHeight);
    doc.setFontSize(fontSize);
    doc.setFont(undefined, isBold ? 'bold' : 'normal');
    doc.text(text, margin, yPosition);
    yPosition += lineHeight;
    return yPosition;
  };

  // Helper function to create a simple table
  const createSimpleTable = (headers, rows) => {
    checkPageBreak(30);
    
    const colWidths = [60, 30, 30, 30, 30]; // Adjust based on your needs
    const rowHeight = 8;
    
    // Draw headers
    doc.setFont(undefined, 'bold');
    doc.setFillColor(41, 128, 185);
    doc.setTextColor(255);
    
    let xPos = margin;
    headers.forEach((header, index) => {
      doc.rect(xPos, yPosition, colWidths[index], rowHeight, 'F');
      doc.text(header, xPos + 2, yPosition + 5);
      xPos += colWidths[index];
    });
    
    yPosition += rowHeight;
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    
    // Draw rows
    rows.forEach((row, rowIndex) => {
      checkPageBreak(rowHeight);
      
      // Alternate row colors
      if (rowIndex % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition, pageWidth - (margin * 2), rowHeight, 'F');
      }
      
      xPos = margin;
      row.forEach((cell, cellIndex) => {
        doc.text(cell.toString(), xPos + 2, yPosition + 5);
        xPos += colWidths[cellIndex];
      });
      
      yPosition += rowHeight;
    });
    
    yPosition += sectionGap;
  };

  // Title Section
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(40);
  doc.text(`Staff Availability Report - ${monthName} ${year}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight * 2;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  doc.text('Cafe Piranha', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight;
  doc.text(`Generated on: ${currentDate}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight;
  doc.text('Real-time Availability Data', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += sectionGap * 2;

  // Calculate statistics for each staff
  const staffStats = staffAvailabilities.map(staff => {
    const availableDays = Object.values(staff.availabilities || {}).filter(day => day.available).length;
    const unavailableDays = 7 - availableDays;
    
    return {
      staffName: staff.staffName || 'Unknown',
      staffId: staff.staffId || 'Unknown',
      totalDaysWorked: availableDays,
      totalDaysNotWorked: unavailableDays,
      totalLeaveDays: unavailableDays,
      lastUpdated: staff.lastUpdated ? new Date(staff.lastUpdated).toLocaleDateString() : 'Never'
    };
  });

  // Staff Summary Table
  addSectionHeader('Staff Availability Summary', 16);
  
  const summaryHeaders = ['Staff Name', 'Staff ID', 'Available Days', 'Unavailable Days', 'Leave Days'];
  const summaryRows = staffStats.map(staff => [
    staff.staffName,
    staff.staffId,
    staff.totalDaysWorked.toString(),
    staff.totalDaysNotWorked.toString(),
    staff.totalLeaveDays.toString()
  ]);
  
  createSimpleTable(summaryHeaders, summaryRows);

  // Detailed Staff Information
  addSectionHeader('Detailed Staff Availability', 16);
  
  staffStats.forEach((staff, index) => {
    checkPageBreak(50);
    
    // Staff header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40);
    doc.text(`${staff.staffName} (ID: ${staff.staffId})`, margin, yPosition);
    yPosition += lineHeight;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Last Updated: ${staff.lastUpdated}`, margin, yPosition);
    yPosition += lineHeight;
    
    // Availability summary
    doc.text(`Available Days: ${staff.totalDaysWorked}/7`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Leave Days: ${staff.totalDaysNotWorked}/7`, margin, yPosition);
    yPosition += lineHeight;
    
    // Daily breakdown
    const staffData = staffAvailabilities.find(s => s.staffId === staff.staffId);
    if (staffData && staffData.availabilities) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      days.forEach(day => {
        checkPageBreak(lineHeight);
        const dayData = staffData.availabilities[day];
        const status = dayData?.available ? 'Available' : 'Not Available';
        const hours = dayData?.available ? `${dayData.startTime} - ${dayData.endTime}` : 'N/A';
        
        doc.setFontSize(8);
        doc.text(`${day.substring(0, 3)}: ${status}`, margin + 10, yPosition);
        doc.text(hours, margin + 80, yPosition);
        yPosition += lineHeight - 1;
      });
    }
    
    yPosition += sectionGap;
    
    // Add separator between staff members (except the last one)
    if (index < staffStats.length - 1) {
      checkPageBreak(10);
      doc.setDrawColor(200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += sectionGap;
    }
  });

  // Overall Summary
  checkPageBreak(50);
  addSectionHeader('Overall Summary Statistics', 16);
  
  const totalDaysWorked = staffStats.reduce((sum, staff) => sum + staff.totalDaysWorked, 0);
  const totalDaysNotWorked = staffStats.reduce((sum, staff) => sum + staff.totalDaysNotWorked, 0);
  const totalLeaveDays = staffStats.reduce((sum, staff) => sum + staff.totalLeaveDays, 0);
  const totalPossibleDays = staffStats.length * 7;
  const availabilityRate = totalPossibleDays > 0 ? (totalDaysWorked / totalPossibleDays) * 100 : 0;

  addText(`Total Staff Members: ${staffStats.length}`, 10, true);
  addText(`Total Available Days: ${totalDaysWorked}`, 10, false);
  addText(`Total Unavailable Days: ${totalDaysNotWorked}`, 10, false);
  addText(`Total Leave Days: ${totalLeaveDays}`, 10, false);
  addText(`Overall Availability Rate: ${availabilityRate.toFixed(1)}%`, 10, true);
  addText(`Average Days Available per Staff: ${(totalDaysWorked / staffStats.length).toFixed(1)}`, 10, false);

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} - Generated on ${currentDate} - Cafe Piranha`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  doc.save(`staff-availability-${monthName}-${year}.pdf`);
};