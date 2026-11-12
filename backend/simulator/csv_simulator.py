import csv
import time
import requests


# ==============================
# SETTINGS
# ==============================

CSV_FILE = r"C:\Users\ASUS\Downloads\VisionShield_Dummy_Sensor_Data_Final.csv"

API_URL = "http://127.0.0.1:8000/api/sensors"

DEFAULT_INTERVAL = 5


# ==============================
# GET READING INTERVAL
# ==============================

def get_read_interval():

    while True:

        user_input = input(
            f"Enter reading interval in seconds "
            f"(press Enter for {DEFAULT_INTERVAL}): "
        ).strip()

        # Use default interval
        if user_input == "":
            return DEFAULT_INTERVAL

        try:
            interval = float(user_input)

            if interval <= 0:
                print("Please enter a value greater than 0.")
                continue

            return interval

        except ValueError:
            print("Please enter a valid number.")


# ==============================
# SEND SENSOR DATA
# ==============================

def send_sensor_data(weight, temperature):

    data = {
        "weight": weight,
        "temperature": temperature
    }

    try:

        response = requests.post(
            API_URL,
            json=data
        )

        if response.ok:

            print(
                f"Sent → Weight: {weight} | "
                f"Temperature: {temperature}"
            )

        else:

            print(
                f"API Error → {response.status_code}: "
                f"{response.text}"
            )

    except requests.exceptions.RequestException as error:

        print(
            f"Connection Error: {error}"
        )


# ==============================
# CSV SIMULATOR
# ==============================

def start_simulator():

    read_interval = get_read_interval()

    print()
    print("===================================")
    print(" VisionShield CSV Sensor Simulator ")
    print("===================================")
    print(
        f"Reading interval: "
        f"{read_interval} seconds"
    )
    print("Press CTRL+C to stop.\n")

    try:

        with open(
            CSV_FILE,
            mode="r",
            newline=""
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                weight = int(row["weight"])

                temperature = float(
                    row["temperature"]
                )

                send_sensor_data(
                    weight,
                    temperature
                )

                time.sleep(
                    read_interval
                )

    except FileNotFoundError:

        print("\nCSV file not found.")

        print(
            f"Expected location:\n"
            f"{CSV_FILE}"
        )

    except KeyboardInterrupt:

        print(
            "\n\nSimulator stopped."
        )


# ==============================
# START PROGRAM
# ==============================

if __name__ == "__main__":

    start_simulator()