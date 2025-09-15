import requests
import sys
import json
from datetime import datetime

class DenAppAPITester:
    def __init__(self, base_url="https://dental-dashboard.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.recep_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_patient_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "JMD", "password": "190582"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin role: {response.get('role')}")
            return True
        return False

    def test_recep_login(self):
        """Test receptionist login"""
        success, response = self.run_test(
            "Receptionist Login",
            "POST",
            "auth/login",
            200,
            data={"username": "MGarcia", "password": "clinic2024"}
        )
        if success and 'token' in response:
            self.recep_token = response['token']
            print(f"   Receptionist role: {response.get('role')}")
            return True
        return False

    def test_invalid_login(self):
        """Test invalid login credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User Info",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   User info: {response.get('username')} - {response.get('role')}")
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Stats: {response}")
        return success

    def test_get_patients(self):
        """Test getting patients list"""
        success, response = self.run_test(
            "Get Patients",
            "GET",
            "patients",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} patients")
        return success

    def test_create_patient(self):
        """Test creating a new patient"""
        patient_data = {
            "nombre": "Test",
            "apellidos": "Patient",
            "tel_movil": "666777888",
            "notas": "Test patient for API testing"
        }
        success, response = self.run_test(
            "Create Patient",
            "POST",
            "patients",
            200,
            data=patient_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_patient_id = response['id']
            print(f"   Created patient with ID: {self.created_patient_id}")
            print(f"   Patient number: {response.get('num_pac')}")
        return success

    def test_update_patient(self):
        """Test updating a patient"""
        if not self.created_patient_id:
            print("❌ No patient ID available for update test")
            return False
            
        updated_data = {
            "nombre": "Updated Test",
            "apellidos": "Updated Patient",
            "tel_movil": "999888777",
            "notas": "Updated test patient"
        }
        success, response = self.run_test(
            "Update Patient",
            "PUT",
            f"patients/{self.created_patient_id}",
            200,
            data=updated_data,
            token=self.admin_token
        )
        return success

    def test_delete_patient(self):
        """Test deleting a patient"""
        if not self.created_patient_id:
            print("❌ No patient ID available for delete test")
            return False
            
        success, _ = self.run_test(
            "Delete Patient",
            "DELETE",
            f"patients/{self.created_patient_id}",
            200,
            token=self.admin_token
        )
        return success

    def test_get_appointments(self):
        """Test getting appointments"""
        success, response = self.run_test(
            "Get Appointments",
            "GET",
            "appointments",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} appointments")
        return success

    def test_get_appointments_by_date(self):
        """Test getting appointments by date"""
        today = datetime.now().strftime("%Y-%m-%d")
        success, response = self.run_test(
            "Get Appointments by Date",
            "GET",
            f"appointments?date={today}",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} appointments for {today}")
        return success

    def test_get_templates(self):
        """Test getting message templates"""
        success, response = self.run_test(
            "Get Templates",
            "GET",
            "templates",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} templates")
        return success

    def test_get_whatsapp_messages(self):
        """Test getting WhatsApp messages"""
        success, response = self.run_test(
            "Get WhatsApp Messages",
            "GET",
            "whatsapp/messages",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} WhatsApp messages")
        return success

    def test_whatsapp_node_service_health(self):
        """Test WhatsApp Node.js service health endpoint"""
        try:
            response = requests.get("http://localhost:3001/health", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                print(f"✅ WhatsApp Service Health - Status: {data.get('status')}")
                print(f"   Service: {data.get('service')}")
                print(f"   Uptime: {data.get('uptime'):.2f}s")
                print(f"   WhatsApp Status: {data.get('whatsapp_status')}")
                self.tests_passed += 1
            else:
                print(f"❌ WhatsApp Service Health - Status: {response.status_code}")
            self.tests_run += 1
            return success
        except Exception as e:
            print(f"❌ WhatsApp Service Health - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_whatsapp_node_service_status(self):
        """Test WhatsApp Node.js service status endpoint"""
        try:
            response = requests.get("http://localhost:3001/status", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                print(f"✅ WhatsApp Service Status - Connection: {data.get('status')}")
                print(f"   Connected: {data.get('connected')}")
                if data.get('user'):
                    print(f"   User: {data.get('user')}")
                if data.get('phone'):
                    print(f"   Phone: {data.get('phone')}")
                self.tests_passed += 1
            else:
                print(f"❌ WhatsApp Service Status - Status: {response.status_code}")
            self.tests_run += 1
            return success
        except Exception as e:
            print(f"❌ WhatsApp Service Status - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_whatsapp_node_service_qr(self):
        """Test WhatsApp Node.js service QR endpoint"""
        try:
            response = requests.get("http://localhost:3001/qr", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                print(f"✅ WhatsApp Service QR - Status: {data.get('status')}")
                if data.get('qr'):
                    print(f"   QR Code: Available (length: {len(data.get('qr'))})")
                    if data.get('expires_at'):
                        print(f"   Expires at: {data.get('expires_at')}")
                else:
                    print(f"   QR Code: Not available")
                self.tests_passed += 1
            else:
                print(f"❌ WhatsApp Service QR - Status: {response.status_code}")
            self.tests_run += 1
            return success
        except Exception as e:
            print(f"❌ WhatsApp Service QR - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_whatsapp_backend_status(self):
        """Test WhatsApp backend integration status"""
        success, response = self.run_test(
            "WhatsApp Backend Status",
            "GET",
            "whatsapp/status",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Backend Status: {response.get('status')}")
            print(f"   Connected: {response.get('connected')}")
            if response.get('user'):
                print(f"   User: {response.get('user')}")
        return success

    def test_whatsapp_backend_qr(self):
        """Test WhatsApp backend integration QR"""
        success, response = self.run_test(
            "WhatsApp Backend QR",
            "GET",
            "whatsapp/qr",
            200,
            token=self.admin_token
        )
        if success:
            if response.get('qr'):
                print(f"   QR Code: Available via backend")
            else:
                print(f"   QR Code: Not available via backend")
        return success

    def test_whatsapp_send_message(self):
        """Test sending WhatsApp message via backend"""
        test_phone = "664123456"
        test_message = "Hola, este es un mensaje de prueba desde DenApp Control"
        
        success, response = self.run_test(
            "WhatsApp Send Message",
            "POST",
            "whatsapp/send-real",
            200,
            data={
                "phone_number": test_phone,
                "message": test_message
            },
            token=self.admin_token
        )
        if success:
            print(f"   Message sent to {test_phone}")
            print(f"   Response: {response}")
        return success

    def test_whatsapp_send_bulk_messages(self):
        """Test sending bulk WhatsApp messages via backend"""
        test_recipients = [
            {"phone_number": "664123456", "name": "Test User 1"},
            {"phone_number": "664123457", "name": "Test User 2"}
        ]
        test_message = "Mensaje masivo de prueba desde DenApp Control"
        
        success, response = self.run_test(
            "WhatsApp Send Bulk Messages",
            "POST",
            "whatsapp/send-bulk-real",
            200,
            data={
                "recipients": test_recipients,
                "message": test_message
            },
            token=self.admin_token
        )
        if success:
            print(f"   Bulk message sent to {len(test_recipients)} recipients")
            print(f"   Response: {response}")
        return success

    def test_whatsapp_node_send_direct(self):
        """Test sending message directly to Node.js service"""
        test_phone = "664123456"
        test_message = "Mensaje directo al servicio Node.js de WhatsApp"
        
        try:
            response = requests.post(
                "http://localhost:3001/send",
                json={
                    "phone_number": test_phone,
                    "message": test_message
                },
                timeout=10
            )
            success = response.status_code == 200
            if success:
                data = response.json()
                print(f"✅ WhatsApp Direct Send - Success: {data.get('success')}")
                if not data.get('success'):
                    print(f"   Error: {data.get('error')}")
                self.tests_passed += 1
            else:
                print(f"❌ WhatsApp Direct Send - Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error')}")
                except:
                    print(f"   Response: {response.text[:200]}")
            self.tests_run += 1
            return success
        except Exception as e:
            print(f"❌ WhatsApp Direct Send - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_whatsapp_node_send_bulk_direct(self):
        """Test sending bulk messages directly to Node.js service"""
        test_recipients = [
            {"phone_number": "664123456", "name": "Test User 1"},
            {"phone_number": "664123457", "name": "Test User 2"}
        ]
        test_message = "Mensaje masivo directo al servicio Node.js"
        
        try:
            response = requests.post(
                "http://localhost:3001/send-bulk",
                json={
                    "recipients": test_recipients,
                    "message": test_message
                },
                timeout=30
            )
            success = response.status_code == 200
            if success:
                data = response.json()
                print(f"✅ WhatsApp Direct Bulk Send - Success: {data.get('success')}")
                print(f"   Total: {data.get('total')}, Sent: {data.get('sent')}, Failed: {data.get('failed')}")
                self.tests_passed += 1
            else:
                print(f"❌ WhatsApp Direct Bulk Send - Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error')}")
                except:
                    print(f"   Response: {response.text[:200]}")
            self.tests_run += 1
            return success
        except Exception as e:
            print(f"❌ WhatsApp Direct Bulk Send - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        success, _ = self.run_test(
            "Unauthorized Access",
            "GET",
            "patients",
            401
        )
        return success

    def test_recep_permissions(self):
        """Test receptionist can access basic endpoints"""
        success, _ = self.run_test(
            "Receptionist Access to Patients",
            "GET",
            "patients",
            200,
            token=self.recep_token
        )
        return success

def main():
    print("🏥 DenApp Control - Backend API Testing")
    print("=" * 50)
    
    tester = DenAppAPITester()
    
    # Authentication Tests
    print("\n📋 AUTHENTICATION TESTS")
    print("-" * 30)
    
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    if not tester.test_recep_login():
        print("❌ Receptionist login failed, stopping tests")
        return 1
    
    tester.test_invalid_login()
    tester.test_auth_me()
    tester.test_unauthorized_access()
    
    # Dashboard Tests
    print("\n📊 DASHBOARD TESTS")
    print("-" * 30)
    tester.test_dashboard_stats()
    
    # Patient Management Tests
    print("\n👥 PATIENT MANAGEMENT TESTS")
    print("-" * 30)
    tester.test_get_patients()
    tester.test_create_patient()
    tester.test_update_patient()
    tester.test_delete_patient()
    
    # Appointment Tests
    print("\n📅 APPOINTMENT TESTS")
    print("-" * 30)
    tester.test_get_appointments()
    tester.test_get_appointments_by_date()
    
    # Template Tests
    print("\n📝 TEMPLATE TESTS")
    print("-" * 30)
    tester.test_get_templates()
    
    # WhatsApp Tests
    print("\n💬 WHATSAPP TESTS")
    print("-" * 30)
    tester.test_get_whatsapp_messages()
    
    # Permission Tests
    print("\n🔐 PERMISSION TESTS")
    print("-" * 30)
    tester.test_recep_permissions()
    
    # Final Results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())