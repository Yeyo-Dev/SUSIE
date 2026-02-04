import os
import pika
import json
import time

def main():
    print("SUSIE AI Engine Starting...")
    
    # RabbitMQ Connection Parameters
    rabbitmq_host = os.getenv('RABBITMQ_HOST', 'localhost')
    
    # Simple retry logic for waiting for RabbitMQ
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host))
            channel = connection.channel()
            break
        except Exception as e:
            print(f"Waiting for RabbitMQ at {rabbitmq_host}... ({e})")
            time.sleep(5)

    channel.queue_declare(queue='ai_processing')

    def callback(ch, method, properties, body):
        print(f" [x] Received {body}")
        # AI Logic goes here

    channel.basic_consume(queue='ai_processing', on_message_callback=callback, auto_ack=True)

    print(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()

if __name__ == '__main__':
    main()
