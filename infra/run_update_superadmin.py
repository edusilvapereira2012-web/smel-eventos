import pexpect
import sys
import os

def run_command_with_auth(cmd, timeout=60):
    print(f"Executing: {cmd}")
    child = pexpect.spawn(cmd, encoding='utf-8')
    child.logfile = sys.stdout

    prompts = [
        r"Are you sure you want to continue connecting",
        r"administrator@190.2.72.72's password:",
        r"\[sudo\] password for administrator:"
    ]

    while True:
        try:
            index = child.expect(prompts + [pexpect.EOF, pexpect.TIMEOUT], timeout=timeout)
            
            if index == 0:
                print(" (Answering yes to fingerprint check)")
                child.sendline('yes')
            elif index == 1 or index == 2:
                child.sendline('=V1LT2R._00')
            elif index == 3:
                # EOF reached
                break
            elif index == 4:
                print("\n❌ Timeout occurred.")
                break
        except Exception as e:
            print(f"\n❌ Exception: {str(e)}")
            break

def main():
    # 1. SCP the script to the VPS
    scp_cmd = "scp infra/update_superadmin.js administrator@190.2.72.72:~/plataforma-eventos/update_superadmin.js"
    print("🚀 Copying script to VPS...")
    run_command_with_auth(scp_cmd)

    # 2. Copy inside docker container, run it, and clean up
    ssh_cmd = 'ssh -t administrator@190.2.72.72 "sudo docker cp ~/plataforma-eventos/update_superadmin.js eventos-api-prod:/app/apps/api/update_superadmin.js && sudo docker exec -w /app/apps/api eventos-api-prod node update_superadmin.js && sudo docker exec eventos-api-prod rm /app/apps/api/update_superadmin.js && rm ~/plataforma-eventos/update_superadmin.js"'
    print("🚀 Executing script inside container and cleaning up...")
    run_command_with_auth(ssh_cmd)

if __name__ == '__main__':
    main()
