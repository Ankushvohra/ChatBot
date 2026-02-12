import csv
import os

def read_csv(file_path):
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file)
        return list(reader)

def read_employee_leave_balance():
    file_path = os.path.join(os.path.dirname(__file__), 'employee_leave_balance.csv')
    return read_csv(file_path)

def get_employee_by_id(emp_id):
    data = read_employee_leave_balance()
    return next((emp for emp in data if emp['Enprise ID'] == emp_id), None)

def get_field_by_employee(emp_id, field_name):
    employee = get_employee_by_id(emp_id)
    return employee.get(field_name) if employee else None

def get_all_fields(emp_id, fields):
    employee = get_employee_by_id(emp_id)
    return {field: employee.get(field) for field in fields} if employee else None
1
if __name__ == '__main__':
    print("\n=== All Employees ===")
    all_data = read_employee_leave_balance()
    print(f"Total Employees: {len(all_data)}\n")
    
    print("=== Employee EMP001 Full Data ===")
    emp = get_employee_by_id('EMP001')
    print(emp)
    
    print("\n=== EMP001 Vacation Days ===")
    vacation = get_field_by_employee('EMP001', 'Vacation')
    print(f"Vacation: {vacation} days")
    
    print("\n=== EMP001 Leave Summary ===")
    summary = get_all_fields('EMP001', ['Vacation', 'Casual Leave', 'Sick and Wellness Leave'])
    print(summary)
