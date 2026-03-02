import matplotlib.pyplot as plt

# Cloud cost data
months = ['Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026']
costs = [570265.00, 71043.00, 71043.00, 91.00, 0.00, 0.00]

# Create visualizations
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))

# 1. Table
ax1.axis('off')
table_data = [[month, f'${cost:,.2f}'] for month, cost in zip(months, costs)]
table = ax1.table(cellText=table_data, colLabels=['Month', 'Cost'], 
                  cellLoc='center', loc='center')
table.auto_set_font_size(False)
table.set_fontsize(10)
ax1.set_title('Cloud Cost Summary', fontweight='bold')

# 2. Bar Chart
bars = ax2.bar(months, costs, color=['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'])
ax2.set_title('Monthly Cloud Costs', fontweight='bold')
ax2.set_ylabel('Cost ($)')
ax2.tick_params(axis='x', rotation=45)
for i, cost in enumerate(costs):
    if cost > 0:
        ax2.text(i, cost, f'${cost:,.0f}', ha='center', va='bottom')

# 3. Pie Chart (non-zero values only)
non_zero_months = [m for m, c in zip(months, costs) if c > 0]
non_zero_costs = [c for c in costs if c > 0]
ax3.pie(non_zero_costs, labels=non_zero_months, autopct='%1.1f%%')
ax3.set_title('Cost Distribution', fontweight='bold')

# 4. Line Chart
ax4.plot(months, costs, marker='o', linewidth=2, markersize=8)
ax4.set_title('Cost Trend', fontweight='bold')
ax4.set_ylabel('Cost ($)')
ax4.tick_params(axis='x', rotation=45)

plt.tight_layout()
plt.show()

# Summary
total = sum(costs)
print(f"Total: ${total:,.2f}")
print(f"Peak: ${max(costs):,.2f} in {months[costs.index(max(costs))]}")