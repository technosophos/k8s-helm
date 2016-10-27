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
	"testing"
)

var testingSocket = DefaultSock

func TestNewClient(t *testing.T) {
	if _, err := NewClient("/no/such/file"); err == nil {
		t.Fatal("expected error attaching to non-existent file")
	}
	if _, err := NewClient("./client_test.go"); err == nil {
		t.Fatal("expected error attaching to non-socket file")
	} else if err.Error() != `file "./client_test.go" is not a socket` {
		t.Errorf("unexpected error: %q", err)
	}
	if _, err := NewClient(testingSocket); err != nil {
		t.Fatal(err)
	}
}

func TestConnect(t *testing.T) {
	c, err := NewClient(testingSocket)
	if err != nil {
		t.Fatal(err)
	}

	if err := c.Connect(); err != nil {
		t.Fatal(err)
	}
	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestHaveKey(t *testing.T) {
	c, err := NewClient(testingSocket)
	if err != nil {
		t.Fatal(err)
	}

	if err := c.Connect(); err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	if err := c.HaveKey("aabbccddeeff11223344556677889900"); err != nil {
		t.Error(err)
	}

}
