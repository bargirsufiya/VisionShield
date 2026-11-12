import requests
import random
import time

API_URL = "http://127.0.0.1:8000/api/sensors"

batch_number = 8

while True:
    batch_id = f"VS-{batch_number:03d}"

    # Every 4th reading is abnormal
    if batch_number % 4 == 0:
        temperature = 1650
        weight = 498
    else:
        temperature = round(random.uniform(20, 30), 1)
        weight = round(random.uniform(450, 550), 1)

    data = {
        "batchId": batch_id,
        "temperature": temperature,
        "weight": weight
    }

    try:
        response = requests.post(API_URL, json=data)

        if response.status_code == 200:
            print(
                f"Data sent successfully | "
                f"{batch_id} | "
                f"Temperature: {temperature} °C | "
                f"Weight: {weight} kg"
            )
        else:
            print(
                f"Failed to send data | "
                f"Status: {response.status_code}"
            )

    except requests.exceptions.RequestException as error:
        print(f"Connection error: {error}")

    batch_number += 1

    time.sleep(10)