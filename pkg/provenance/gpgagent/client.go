/*
Copyright 2016 The Kubernetes Authors All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package gpgagent

import (
	"fmt"
	"net"
	"os"
)

const DefaultSock = "$HOME/.gnupg/S.gpg-agent"

type Client struct {
	file string
	conn net.Conn
}

// NewClient creates a new client pointing to the given socket.
//
// The socket must be a local UNIX-style socket to a GnuPG agent. If the socket
// is not found, this will return an error. However, merely finding the socket
// does not ensure that the socket is backed by an appropriate server.
func NewClient(socket string) (*Client, error) {
	socket = os.ExpandEnv(socket)
	if fi, err := os.Stat(socket); err != nil {
		return nil, err
	} else if (fi.Mode() & os.ModeSocket) == 0 {
		return nil, fmt.Errorf("file %q is not a socket", socket)
	}

	return &Client{file: socket}, nil
}

func (c *Client) Connect() error {
	conn, err := net.Dial("unix", c.file)
	if err != nil {
		return err
	}

	// Sanity check to make sure this is acting like a GnuPG agent.
	if err := sendMsg(conn, "GETINFO version\n"); err != nil {
		return err
	}
	if _, err := readMsg(conn); err != nil {
		return err
	}

	c.conn = conn
	return nil
}

func sendMsg(conn net.Conn, str string) error {
	if _, err := conn.Write([]byte("GETINFO version\n")); err != nil {
		conn.Close()
		return err
	}
	return nil
}

func readMsg(conn net.Conn) (string, error) {
	buf := make([]byte, 2048)
	i, err := conn.Read(buf)
	if err != nil {
		conn.Close()
		return "", err
	}
	str := string(buf[0:i])
	fmt.Printf("%d bytes: %q\n", i, str)
	return str, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

func (c *Client) HaveKey(key string) error {
	err := sendMsg(c.conn, "HAVEKEY "+key)
	if err != nil {
		return err
	}

	str, err := readMsg(c.conn)
	if err != nil {
		return err
	}

	fmt.Println(str)

	return nil
}

func (c *Client) PKDecrypt(key string) error {
	return nil
}
