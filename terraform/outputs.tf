output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.web.public_ip
}

output "application_url" {
  description = "URL to access the application"
  value       = "https://${aws_instance.web.public_ip}"
}

output "ssh_command" {
  description = "Command to SSH into the instance to run docker services and check"
  value       = "ssh -i <path-to-key>.pem ec2-user@${aws_instance.web.public_ip}"
}
