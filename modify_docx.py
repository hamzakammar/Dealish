#!/usr/bin/env python3
import zipfile
import os

# Read the template
with zipfile.ZipFile('template.docx', 'r') as template_zip:
    # Read document.xml
    with template_zip.open('word/document.xml') as doc_xml:
        content = doc_xml.read().decode('utf-8')

# Define replacements
replacements = {
    '[Student Name]': 'Hamza Ammar',
    '[Section]': '082',
    '[Date]': 'May 27, 2026',
    '[Interviewee]': 'Dennis Theisen, Full Stack Developer at Shopify',
    '[Describe]': "On Wednesday, May 27, 2026, I met with Dennis Theisen, a Full Stack Developer at Shopify, for a 15-minute informal coffee chat. Dennis is a highly regarded engineer known for his deep technical contributions to Shopify's payment and checkout infrastructure and his active role in open-source Ruby libraries like Active Merchant. My goals for this interview were to learn about the trajectory from university to a senior individual contributor role, understand which skills are most critical in the early career stages, and get a feel for the day-to-day reality of engineering at Shopify's scale. We covered Dennis's path from his first internship to his current seniority, the importance of shipping real products over theoretical exercises, and how open-source work can serve as a major career differentiator.",
    '[Examine]': "I consider this interview moderately successful. I hit my primary goal of understanding Dennis's career trajectory, but we ran out of time before I could get into the specifics of Shopify's internal team structures. I would have liked to ask more about how he balances his internal responsibilities with high-level open-source maintenance and how he manages the balance between shipping velocity and code quality. What worked well was preparing three specific questions in advance; this kept the 15-minute window tight and productive. If I were to do this again, I would send a brief context email beforehand so the interviewee has a better sense of my goals before we sit down.",
    '[Learning Interview]': "From the interview itself, I learned that open-source contribution is a legitimate and powerful career signal—Dennis's work on Active Merchant was a primary differentiator in his own hiring process. I also learned that while depth is important later, breadth is underrated early in a career; understanding the full stack provides a stronger mental model for solving complex problems. Finally, Dennis emphasized that communication often outweighs code—the ability to explain technical trade-offs to non-technical stakeholders is usually the gap between a mid-level and a senior engineer.",
    '[Learning Process]': 'From the process, I learned that internal networking is far more accessible than cold outreach; people within your company are usually happy to help interns. I also realized that preparation is the greatest multiplier for value in short meetings. While informational interviews can feel awkward to request, the fear of asking is almost always worse than the reality. Moving forward, I will be more proactive in using these chats to build my professional network.'
}

# Perform replacements
for old, new in replacements.items():
    content = content.replace(old, new)

# Create the new docx file
with zipfile.ZipFile('template.docx', 'r') as template_zip:
    with zipfile.ZipFile('PD19_Assignment_3.docx', 'w', zipfile.ZIP_DEFLATED) as output_zip:
        # Copy all files from template
        for item in template_zip.infolist():
            if item.filename == 'word/document.xml':
                # Write the modified document.xml
                output_zip.writestr(item, content.encode('utf-8'))
            else:
                # Copy other files as-is
                output_zip.writestr(item, template_zip.read(item.filename))

print("Successfully created PD19_Assignment_3.docx")
