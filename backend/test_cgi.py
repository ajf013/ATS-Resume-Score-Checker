import cgi
import io

body = b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\r\n--boundary--\r\n'

headers = {'content-type': 'multipart/form-data; boundary=boundary', 'content-length': str(len(body))}

fs = cgi.FieldStorage(
    fp=io.BytesIO(body),
    headers=headers,
    environ={'REQUEST_METHOD': 'POST'}
)

print(fs['file'].file.read())
