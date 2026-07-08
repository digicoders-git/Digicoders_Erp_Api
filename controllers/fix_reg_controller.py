import re

with open("../controllers/registrationController.js", "r") as f:
    content = f.read()

# Replace block where discount is updated
block = re.search(r'if \(typeof discount !== "undefined" && discount !== ""\) \{\n.*?student\.dueAmount = Math\.max\(student\.finalFee - student\.paidAmount, 0\);', content, re.DOTALL)
if block:
    replacement = '''if (typeof discount !== "undefined" && discount !== "") {
      const parsedDiscount = Number(discount);
      const possibleFinalFee = student.totalFee - parsedDiscount;
      const currentPaid = student.paidAmount || 0;
      
      // Prevent discount from making finalFee less than what is already paid
      if (possibleFinalFee < currentPaid) {
         student.discount = student.totalFee - currentPaid;
         student.finalFee = currentPaid;
      } else {
         student.discount = parsedDiscount;
         student.finalFee = possibleFinalFee;
      }
      student.dueAmount = Math.max(student.finalFee - student.paidAmount, 0);'''
    content = content.replace(block.group(0), replacement)

with open("../controllers/registrationController.js", "w") as f:
    f.write(content)
print("Updated registrationController.js")
